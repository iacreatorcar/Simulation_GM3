// app.js - Core applicativo: fader, cue via API, scene via localStorage, toast, tema, command line
// Namespace globale condiviso dai moduli aggiuntivi (module-*.js)
window.GMA3 = window.GMA3 || {};

(function () {
  'use strict';

  const NUM_FADERS = 16;
  const STORAGE_KEY = 'gma3_scenes';

  const state = {
    faders: Array.from({ length: NUM_FADERS }, () => 0), // valori 0-100
    selectedChannels: [], // canali selezionati dalla command line (0-based)
    // Hue per canale (0-360), usato dallo Stage View e dal Design Creator.
    // Generato ciclando una tavolozza base cosi' da coprire NUM_FADERS canali.
    channelColors: Array.from({ length: NUM_FADERS }, (_, i) => [180, 210, 140, 320, 50, 0, 260, 30][i % 8])
  };

  // --- Toast notifiche -------------------------------------------------
  function toast(message, type = 'info') {
    console.log(`[TOAST:${type}] ${message}`);
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`.trim();
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function setStatus(text) {
    const el = document.getElementById('statusText');
    if (el) el.textContent = text;
    console.log('[STATUS]', text);
  }

  // --- Fader: costruzione DOM -------------------------------------------
  function buildFaders() {
    const bank = document.getElementById('faderBank');
    if (!bank) return;
    bank.innerHTML = '';

    for (let i = 0; i < NUM_FADERS; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'fader';
      wrap.innerHTML = `
        <div class="fader-led" id="faderLed${i}"></div>
        <div class="fader-value" id="faderVal${i}">0%</div>
        <div class="fader-track" id="faderTrack${i}" data-index="${i}" tabindex="0">
          <div class="fader-fill" id="faderFill${i}"></div>
          <div class="fader-handle" id="faderHandle${i}"></div>
        </div>
        <div class="fader-label">CH ${i + 1}</div>
      `;
      bank.appendChild(wrap);
    }

    for (let i = 0; i < NUM_FADERS; i++) {
      attachFaderEvents(i);
      renderFader(i);
    }
  }

  // Aggiorna la grafica del fader in base al valore in state.faders[i]
  function renderFader(i) {
    const track = document.getElementById(`faderTrack${i}`);
    const fill = document.getElementById(`faderFill${i}`);
    const handle = document.getElementById(`faderHandle${i}`);
    const val = document.getElementById(`faderVal${i}`);
    const led = document.getElementById(`faderLed${i}`);
    if (!track) return;

    const pct = state.faders[i];
    const trackHeight = track.clientHeight;
    const handleHeight = handle.offsetHeight || 10;

    fill.style.height = `${pct}%`;
    // handle posizionato dal basso, clampato per non uscire dal track
    const bottomPx = (pct / 100) * (trackHeight - handleHeight);
    handle.style.bottom = `${bottomPx}px`;
    val.textContent = `${Math.round(pct)}%`;
    if (led) led.classList.toggle('on', pct > 0);
    drawStage();
    const dimCell = document.getElementById(`patchDim${i}`);
    if (dimCell) dimCell.textContent = `${Math.round(pct)}%`;
    const designCell = document.getElementById(`designLevel${i}`);
    if (designCell) designCell.textContent = `${Math.round(pct)}%`;
  }

  // Calcola la percentuale in base alla posizione Y del puntatore dentro il track
  function pctFromClientY(track, clientY) {
    const rect = track.getBoundingClientRect();
    const relY = clientY - rect.top;
    let pct = 100 - (relY / rect.height) * 100;
    pct = Math.max(0, Math.min(100, pct));
    return pct;
  }

  // FIX: il drag non funzionava perche' il listener mousemove era registrato
  // solo sul singolo elemento invece che su document, quindi si perdeva
  // il movimento appena il puntatore usciva dall'handle/track.
  // Ora si usa pointer capture su document con mousedown/mousemove/mouseup
  // + supporto touch per mobile.
  function attachFaderEvents(i) {
    const track = document.getElementById(`faderTrack${i}`);
    const handle = document.getElementById(`faderHandle${i}`);
    let dragging = false;

    function onMove(clientY) {
      const pct = pctFromClientY(track, clientY);
      state.faders[i] = pct;
      renderFader(i);
    }

    function startDrag(clientY) {
      dragging = true;
      onMove(clientY);
      console.log(`Fader ${i}: drag avviato`);
    }

    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      console.log(`Fader ${i}: drag terminato a ${Math.round(state.faders[i])}%`);
    }

    // Mouse
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(e.clientY);
    });
    track.addEventListener('mousedown', (e) => {
      // click diretto sulla barra (non sull'handle) salta al valore
      if (e.target === handle) return;
      startDrag(e.clientY);
    });
    document.addEventListener('mousemove', (e) => {
      if (dragging) onMove(e.clientY);
    });
    document.addEventListener('mouseup', stopDrag);

    // Touch
    handle.addEventListener('touchstart', (e) => {
      startDrag(e.touches[0].clientY);
    }, { passive: true });
    track.addEventListener('touchstart', (e) => {
      if (e.target === handle) return;
      startDrag(e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (dragging) onMove(e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchend', stopDrag);
  }

  // --- API Cue -----------------------------------------------------------
  async function apiRequest(url, options = {}) {
    console.log('[API]', options.method || 'GET', url);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.errors?.join(', ') || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error('[API ERROR]', err);
      throw err;
    }
  }

  // --- Supabase: persistenza reale delle cue + sync realtime tra sessioni ------
  // Se il client Supabase non e' configurato (niente .env / CDN non caricato),
  // si ricade sulle vecchie rotte Express in memoria come fallback.
  let sbClient = null;

  async function initSupabase() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || typeof window.supabase === 'undefined') {
        console.log('[supabase] Non configurato, uso il fallback in memoria su Express');
        return;
      }
      sbClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      console.log('[supabase] Client inizializzato:', cfg.supabaseUrl);

      // Realtime: qualunque client connesso vede subito le cue create/eliminate
      // da un altro client, senza bisogno di ricaricare la pagina.
      sbClient
        .channel('cues-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cues' }, (payload) => {
          console.log('[supabase] Realtime event:', payload.eventType);
          loadCues();
        })
        .subscribe();
    } catch (err) {
      console.error('[supabase] Init fallita, fallback in memoria:', err);
    }
  }

  async function createCue(name, fadeTime, effect) {
    try {
      if (sbClient) {
        const { data, error } = await sbClient
          .from('cues')
          .insert([{ name, fade_time: fadeTime, effect, faders: [...state.faders] }])
          .select()
          .single();
        if (error) throw new Error(error.message);
        toast(`Cue "${data.name}" stored`, 'success');
        await loadCues();
        return;
      }

      const data = await apiRequest('/api/cue/create', {
        method: 'POST',
        body: JSON.stringify({ name, fadeTime, effect, faders: [...state.faders] })
      });
      toast(`Cue "${data.cue.name}" stored`, 'success');
      await loadCues();
    } catch (err) {
      toast(`Failed to store cue: ${err.message}`, 'error');
    }
  }

  async function loadCues() {
    try {
      if (sbClient) {
        const { data, error } = await sbClient.from('cues').select('*').order('id');
        if (error) throw new Error(error.message);
        const cues = data.map((row) => ({
          id: row.id,
          name: row.name,
          fadeTime: row.fade_time,
          effect: row.effect,
          faders: row.faders,
          createdAt: row.created_at
        }));
        renderCueList(cues);
        setStatus(`${cues.length} cue(s) loaded (Supabase)`);
        return;
      }

      const data = await apiRequest('/api/cue/list');
      renderCueList(data.cues);
      setStatus(`${data.count} cue(s) loaded`);
    } catch (err) {
      toast(`Failed to load cues: ${err.message}`, 'error');
    }
  }

  function fireCue(cue) {
    if (Array.isArray(cue.faders) && cue.faders.length) {
      state.faders = padFaders(cue.faders);
      for (let i = 0; i < NUM_FADERS; i++) renderFader(i);
    }
    if (cue.effect && cue.effect !== 'none') {
      startEffect(cue.effect, 400, 8000); // l'effetto gira per 8s poi si ferma da solo
      toast(`Cue "${cue.name}" fired - effect: ${cue.effect}`, 'success');
    } else {
      stopEffect();
      toast(`Cue "${cue.name}" fired`, 'success');
    }
    console.log('[cue] Fired:', cue.name, cue.effect);
  }

  async function deleteCue(id) {
    try {
      if (sbClient) {
        const { error } = await sbClient.from('cues').delete().eq('id', id);
        if (error) throw new Error(error.message);
        toast(`Cue #${id} deleted`, 'success');
        await loadCues();
        return;
      }

      await apiRequest(`/api/cue/${id}`, { method: 'DELETE' });
      toast(`Cue #${id} deleted`, 'success');
      await loadCues();
    } catch (err) {
      toast(`Failed to delete cue: ${err.message}`, 'error');
    }
  }

  // Palette ispirata alla griglia colorata delle sequenze reali MA3
  const TILE_PALETTE = ['tile-cyan', 'tile-blue', 'tile-green', 'tile-magenta', 'tile-yellow', 'tile-red'];
  const MIN_GRID_SLOTS = 12; // una console reale mostra sempre la griglia piena di slot, vuoti o pieni

  // Aggiunge tile vuote fino a riempire la griglia, cosi' il pannello non appare
  // mai come un riquadro vuoto ma come una vera pagina di sequenza con slot liberi.
  function padWithEmptySlots(list, count, minSlots) {
    for (let i = count; i < minSlots; i++) {
      const li = document.createElement('li');
      li.className = 'tile-empty';
      li.innerHTML = `<span class="tile-id">${i + 1}</span>`;
      list.appendChild(li);
    }
  }

  function renderCueList(cues) {
    const list = document.getElementById('cueList');
    if (!list) return;
    list.innerHTML = '';
    cues.forEach((cue, index) => {
      const li = document.createElement('li');
      li.className = TILE_PALETTE[index % TILE_PALETTE.length];
      li.innerHTML = `
        <span class="tile-id">#${cue.id}</span>
        <span class="tile-name">${cue.name}</span>
        <span class="tile-meta">${cue.fadeTime}s ${cue.effect && cue.effect !== 'none' ? '· ' + cue.effect : ''}</span>
        <span class="tile-actions">
          <button class="goBtn">GO</button>
          <button class="delBtn">X</button>
        </span>
      `;
      li.querySelector('.goBtn').addEventListener('click', () => fireCue(cue));
      li.querySelector('.delBtn').addEventListener('click', () => deleteCue(cue.id));
      list.appendChild(li);
    });
    padWithEmptySlots(list, cues.length, MIN_GRID_SLOTS);
  }

  // --- Scene via localStorage ----------------------------------------------
  function loadScenesFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Errore lettura localStorage:', err);
      return [];
    }
  }

  function saveScenesToStorage(scenes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
  }

  function saveScene(name) {
    if (!name || !name.trim()) {
      toast('Enter a name for the scene', 'error');
      return;
    }
    const scenes = loadScenesFromStorage();
    const scene = {
      id: Date.now(),
      name: name.trim(),
      faders: [...state.faders],
      savedAt: new Date().toISOString()
    };
    scenes.push(scene);
    saveScenesToStorage(scenes);
    console.log('Scena salvata in localStorage:', scene);
    toast(`Scene "${scene.name}" stored`, 'success');
    renderScenes();
  }

  // Adatta un array di fader di lunghezza qualsiasi (es. salvato quando i canali
  // erano meno) a NUM_FADERS, riempiendo gli slot mancanti con 0 invece di
  // lasciare undefined (che genererebbe NaN nei calcoli di rendering).
  function padFaders(arr) {
    return Array.from({ length: NUM_FADERS }, (_, i) => (typeof arr[i] === 'number' ? arr[i] : 0));
  }

  function loadScene(id) {
    const scenes = loadScenesFromStorage();
    const scene = scenes.find((s) => String(s.id) === String(id));
    if (!scene) return;
    state.faders = padFaders(scene.faders);
    for (let i = 0; i < NUM_FADERS; i++) renderFader(i);
    toast(`Scene "${scene.name}" recalled`, 'success');
    console.log('Scena caricata:', scene);
  }

  function deleteScene(id) {
    let scenes = loadScenesFromStorage();
    scenes = scenes.filter((s) => String(s.id) !== String(id));
    saveScenesToStorage(scenes);
    toast('Scene deleted', 'success');
    renderScenes();
  }

  function renderScenes() {
    const list = document.getElementById('sceneList');
    if (!list) return;
    const scenes = loadScenesFromStorage();
    list.innerHTML = '';
    scenes.forEach((scene, index) => {
      const li = document.createElement('li');
      li.className = TILE_PALETTE[(index + 2) % TILE_PALETTE.length];
      li.innerHTML = `
        <span class="tile-name">${scene.name}</span>
        <span class="tile-actions">
          <button class="loadBtn">GO</button>
          <button class="delBtn">X</button>
        </span>
      `;
      li.querySelector('.loadBtn').addEventListener('click', () => loadScene(scene.id));
      li.querySelector('.delBtn').addEventListener('click', () => deleteScene(scene.id));
      list.appendChild(li);
    });
    padWithEmptySlots(list, scenes.length, MIN_GRID_SLOTS);
  }

  // --- Dark mode toggle ------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem('gma3_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('gma3_theme', next);
        console.log('Tema cambiato:', next);
      });
    }
  }

  // --- Clock -------------------------------------------------------------
  function tickClock() {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-GB');
  }

  // --- Command line ------------------------------------------------------
  // Parser minimale ispirato alla sintassi MA3: gestisce keyword semplici
  // digitate sulla command line in fondo alla console.
  function logCommand(text, isError = false) {
    const log = document.getElementById('cmdLog');
    if (!log) return;
    const line = document.createElement('div');
    if (isError) line.className = 'log-error';
    line.textContent = `> ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 40) log.removeChild(log.firstChild);
  }

  function runCommand(raw) {
    const cmd = raw.trim().toUpperCase();
    if (!cmd) return;
    console.log('[CMD]', cmd);
    logCommand(raw);

    const atMatch = cmd.match(/^AT\s+(\d+)$/);

    if (cmd === 'FULL') {
      for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = 100; renderFader(i); }
      setStatus('All channels set to Full');
      toast('FULL executed', 'success');
    } else if (cmd === 'OFF' || cmd === 'BLACKOUT') {
      for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = 0; renderFader(i); }
      setStatus('All channels set to Off');
      toast('OFF executed', 'success');
    } else if (cmd === 'CLEAR') {
      state.selectedChannels = [];
      setStatus('Selection cleared');
      toast('CLEAR executed', 'info');
    } else if (atMatch) {
      const level = Math.max(0, Math.min(100, parseInt(atMatch[1], 10)));
      const targets = state.selectedChannels.length ? state.selectedChannels : Array.from({ length: NUM_FADERS }, (_, i) => i);
      targets.forEach((i) => { state.faders[i] = level; renderFader(i); });
      setStatus(`AT ${level} applied to ${targets.length} channel(s)`);
      toast(`AT ${level} executed`, 'success');
    } else {
      setStatus(`Unknown command: "${raw}"`);
      toast(`Unknown command: "${raw}"`, 'error');
      logCommand(`Unknown command: "${raw}"`, true);
    }
  }

  function initCommandLine() {
    const input = document.getElementById('cmdInput');
    const btn = document.getElementById('cmdExecute');
    if (!input || !btn) return;

    function submit() {
      runCommand(input.value);
      input.value = '';
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    window.GMA3._cmdSubmit = submit;
  }

  // --- Numeric keypad: scrive sulla command line come una console reale --------
  function initKeypad() {
    const keypad = document.getElementById('keypad');
    const input = document.getElementById('cmdInput');
    if (!keypad || !input) return;

    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      const key = btn.dataset.key;
      console.log('[keypad]', key);

      if (key === 'ENTER') {
        window.GMA3._cmdSubmit();
      } else if (key === 'CLR') {
        input.value = '';
      } else if (key === 'BACK') {
        input.value = input.value.slice(0, -1);
      } else if (key === 'GO') {
        runCommand('FULL');
      } else if (key === 'OFF') {
        runCommand('OFF');
      } else if (key === 'AT') {
        input.value += (input.value.endsWith(' ') || !input.value ? '' : ' ') + 'AT ';
      } else if (key === 'THRU') {
        input.value += ' THRU ';
      } else {
        input.value += key;
      }
      input.focus();
    });
  }

  // --- Demo data -----------------------------------------------------------
  // Precarica scene dimostrative se non ne esistono gia' in localStorage.
  // Servono sia come esempio (2 scene "vetrina") sia come materiale per il
  // modulo Automation (che le fa alternare ogni N secondi).
  function seedDemoScenes(force = false) {
    const existing = loadScenesFromStorage();
    if (existing.length > 0 && !force) return;

    const demoScenes = [
      {
        id: Date.now(),
        name: 'Demo 1 - Warm Wash',
        faders: Array.from({ length: NUM_FADERS }, (_, i) => Math.max(0, 80 - i * 12)),
        savedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 1,
        name: 'Demo 2 - Cool Wash',
        faders: Array.from({ length: NUM_FADERS }, (_, i) => Math.min(100, i * 12)),
        savedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 2,
        name: 'Demo 3 - Full Stage',
        faders: Array.from({ length: NUM_FADERS }, () => 100),
        savedAt: new Date().toISOString()
      }
    ];

    saveScenesToStorage(demoScenes);
    console.log('[demo] Scene dimostrative precaricate:', demoScenes.length);
    renderScenes();
  }

  // --- Tutorial mode ---------------------------------------------------------
  // Overlay guidato che evidenzia i pannelli principali passo dopo passo.
  const tutorialSteps = [
    { selector: '#panelFaders', text: 'Fader Sheet: drag the handle or click the track to set channel intensity (0-100%).' },
    { selector: '.cmd-line', text: 'Command line: type FULL, OFF, AT <value> or CLEAR and press Enter.' },
    { selector: '#panelCue', text: 'Cue Pool: store the current fader state as a cue on the server, list and delete it.' },
    { selector: '#panelScenes', text: 'Scene Pool: save/recall fader snapshots in the browser (localStorage). Demo scenes are preloaded.' },
    { selector: '#panelAutomation', text: 'Automation: loops through stored scenes automatically - try it with the 3 demo scenes.' },
    { selector: '#panelMonitoring', text: 'DMX Monitor: live view of the DMX value (0-255) for every channel.' },
    { selector: '#panelHotkeys', text: 'Hotkeys: B=Blackout, F=Full, S=focus Store Scene, D=toggle theme, 1-8=focus a fader.' }
  ];
  let tutorialIndex = 0;

  function highlightTutorialTarget(selector) {
    document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'));
    const target = document.querySelector(selector);
    if (target) {
      target.classList.add('tutorial-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function renderTutorialStep() {
    const step = tutorialSteps[tutorialIndex];
    const text = document.getElementById('tutorialText');
    const counter = document.getElementById('tutorialCounter');
    if (text) text.textContent = step.text;
    if (counter) counter.textContent = `${tutorialIndex + 1} / ${tutorialSteps.length}`;
    highlightTutorialTarget(step.selector);
  }

  function openTutorial() {
    tutorialIndex = 0;
    const overlay = document.getElementById('tutorialOverlay');
    if (overlay) overlay.style.display = 'flex';
    renderTutorialStep();
    console.log('[tutorial] Avviato');
  }

  function closeTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    if (overlay) overlay.style.display = 'none';
    document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'));
    console.log('[tutorial] Chiuso');
  }

  function initTutorial() {
    const openBtn = document.getElementById('tutorialToggle');
    const nextBtn = document.getElementById('tutorialNext');
    const prevBtn = document.getElementById('tutorialPrev');
    const closeBtn = document.getElementById('tutorialClose');

    if (openBtn) openBtn.addEventListener('click', openTutorial);
    if (closeBtn) closeBtn.addEventListener('click', closeTutorial);
    if (nextBtn) nextBtn.addEventListener('click', () => {
      tutorialIndex = (tutorialIndex + 1) % tutorialSteps.length;
      renderTutorialStep();
    });
    if (prevBtn) prevBtn.addEventListener('click', () => {
      tutorialIndex = (tutorialIndex - 1 + tutorialSteps.length) % tutorialSteps.length;
      renderTutorialStep();
    });
  }

  // --- Fixture Patch: assigns a type + DMX address to each channel ------------
  const PATCH_KEY = 'gma3_patch';
  const FIXTURE_TYPES = [
    'PAR LED', 'Moving Head Spot', 'Moving Head Wash', 'Beam', 'Strobe', 'Wash RGBW',
    'Mirror Ball', 'Fog Machine', 'LED Bar', 'Blinder', 'Fresnel', 'Profile/Spot'
  ];

  function loadPatch() {
    try {
      const raw = localStorage.getItem(PATCH_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.error('Errore lettura patch:', err);
    }
    // Patch di default: un fixture ogni 4 canali DMX (Dim/R/G/B tipico)
    return Array.from({ length: NUM_FADERS }, (_, i) => ({
      name: `Fixture ${i + 1}`,
      type: FIXTURE_TYPES[i % FIXTURE_TYPES.length],
      address: i * 4 + 1
    }));
  }

  function savePatch(patch) {
    localStorage.setItem(PATCH_KEY, JSON.stringify(patch));
  }

  function renderFaderLabels() {
    const patch = loadPatch();
    for (let i = 0; i < NUM_FADERS; i++) {
      const label = document.querySelector(`#panelFaders .fader:nth-child(${i + 1}) .fader-label`);
      if (label && patch[i]) label.textContent = `${patch[i].name} @${patch[i].address}`;
    }
  }

  // Pan/Tilt sono puramente decorativi (nessun vero motore pan/tilt simulato):
  // generano una coppia di valori stabile per fixture, solo per somigliare
  // alla Fixture Sheet reale.
  function decorativePanTilt(index) {
    const pan = (((index * 37) % 180) - 90).toFixed(1);
    const tilt = (((index * 53) % 90) - 45).toFixed(1);
    return { pan, tilt };
  }

  function renderPatchTable() {
    const body = document.getElementById('patchBody');
    if (!body) return;
    const patch = loadPatch();
    body.innerHTML = '';

    patch.forEach((fixture, i) => {
      const typeOptions = FIXTURE_TYPES.map((t) => `<option value="${t}" ${t === fixture.type ? 'selected' : ''}>${t}</option>`).join('');
      const { pan, tilt } = decorativePanTilt(i);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><input type="text" data-field="name" value="${fixture.name}"></td>
        <td><select data-field="type">${typeOptions}</select></td>
        <td><input type="number" data-field="address" min="1" max="512" value="${fixture.address}"></td>
        <td class="patch-dim" id="patchDim${i}">0%</td>
        <td class="patch-decorative">${pan}</td>
        <td class="patch-decorative">${tilt}</td>
        <td><span class="gobo-dot"></span></td>
      `;

      tr.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('change', () => {
          const current = loadPatch();
          const field = el.dataset.field;
          current[i][field] = field === 'address' ? parseInt(el.value, 10) || 1 : el.value;
          savePatch(current);
          renderFaderLabels();
          console.log('[patch] Aggiornato canale', i + 1, current[i]);
          toast(`Patch updated: CH${i + 1}`, 'success');
        });
      });

      body.appendChild(tr);
    });

    renderPatchDimColumn();
  }

  // Aggiorna solo la colonna Dim della Fixture Sheet in base ai fader correnti,
  // senza ricostruire l'intera tabella (chiamata ad ogni renderFader).
  function renderPatchDimColumn() {
    for (let i = 0; i < NUM_FADERS; i++) {
      const cell = document.getElementById(`patchDim${i}`);
      if (cell) cell.textContent = `${Math.round(state.faders[i])}%`;
    }
  }

  function initPatch() {
    savePatch(loadPatch()); // assicura che il default venga persistito al primo avvio
    renderPatchTable();
    renderFaderLabels();
  }

  // --- Setup page: decorative menu like MA3's Setup screen -------------------
  // --- Design Creator: assign a color per channel and save the combined look
  // (fader levels + colors) as a "Design", separate from plain Scenes.
  const DESIGN_KEY = 'gma3_designs';
  const DESIGN_COLORS = [
    { name: 'Red', hue: 0 }, { name: 'Amber', hue: 30 }, { name: 'Yellow', hue: 55 },
    { name: 'Green', hue: 120 }, { name: 'Cyan', hue: 180 }, { name: 'Blue', hue: 220 },
    { name: 'Violet', hue: 270 }, { name: 'Magenta', hue: 320 }, { name: 'White', hue: -1 }
  ];

  function loadDesigns() {
    try {
      const raw = localStorage.getItem(DESIGN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Errore lettura design:', err);
      return [];
    }
  }

  function saveDesigns(designs) {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(designs));
  }

  function renderDesignTable() {
    const body = document.getElementById('designBody');
    if (!body) return;
    const patch = loadPatch();
    body.innerHTML = '';

    for (let i = 0; i < NUM_FADERS; i++) {
      const swatches = DESIGN_COLORS.map((c) => `
        <button class="color-swatch design-swatch" data-index="${i}" data-hue="${c.hue}" title="${c.name}"
          style="background:${c.hue < 0 ? '#fff' : `hsl(${c.hue},80%,55%)`}"></button>
      `).join('');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${patch[i] ? patch[i].name : `Fixture ${i + 1}`}</td>
        <td class="design-swatch-row">${swatches}</td>
        <td id="designLevel${i}">${Math.round(state.faders[i])}%</td>
      `;
      body.appendChild(tr);
    }

    body.querySelectorAll('.design-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        state.channelColors[idx] = parseInt(btn.dataset.hue, 10);
        drawStage();
        console.log('[design] Colore canale', idx + 1, '->', btn.dataset.hue);
        toast(`CH${idx + 1} color set: ${btn.title}`, 'info');
      });
    });
  }

  function saveDesign(name) {
    if (!name || !name.trim()) {
      toast('Enter a name for the design', 'error');
      return;
    }
    const designs = loadDesigns();
    designs.push({
      id: Date.now(),
      name: name.trim(),
      faders: [...state.faders],
      colors: [...state.channelColors],
      savedAt: new Date().toISOString()
    });
    saveDesigns(designs);
    toast(`Design "${name.trim()}" stored`, 'success');
    console.log('[design] Salvato:', name.trim());
    renderDesignList();
  }

  function applyDesign(design) {
    state.faders = padFaders(design.faders);
    state.channelColors = Array.from({ length: NUM_FADERS }, (_, i) => (typeof design.colors[i] === 'number' ? design.colors[i] : 0));
    for (let i = 0; i < NUM_FADERS; i++) renderFader(i);
    drawStage();
    toast(`Design "${design.name}" applied`, 'success');
  }

  function deleteDesign(id) {
    const designs = loadDesigns().filter((d) => String(d.id) !== String(id));
    saveDesigns(designs);
    toast('Design deleted', 'success');
    renderDesignList();
  }

  function renderDesignList() {
    const list = document.getElementById('designList');
    if (!list) return;
    const designs = loadDesigns();
    list.innerHTML = '';
    designs.forEach((design) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${design.name}</span>
        <span class="tile-actions">
          <button class="loadBtn">GO</button>
          <button class="delBtn">X</button>
        </span>
      `;
      li.querySelector('.loadBtn').addEventListener('click', () => applyDesign(design));
      li.querySelector('.delBtn').addEventListener('click', () => deleteDesign(design.id));
      list.appendChild(li);
    });
  }

  function initDesignTab() {
    renderDesignTable();
    renderDesignList();
    const saveBtn = document.getElementById('saveDesignBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const input = document.getElementById('designName');
        saveDesign(input.value);
        input.value = '';
      });
    }
  }

  function initSetupPage() {
    const closeBtn = document.getElementById('setupClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="pools"]')?.click();
      });
    }
    document.querySelectorAll('.setup-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        console.log('[setup]', btn.textContent);
        toast(`"${btn.textContent}" is not implemented in this trainer`, 'info');
      });
    });
  }

  // --- Executor flash buttons: momentary full, one per channel ----------------
  // --- Encoders: draggable Pan/Tilt/Zoom/Color/Gobo, beside the fader bank ----
  // Trascinamento verticale (mouse o touch) come i fader, ma il valore ruota
  // l'indicatore invece di riempire una barra.
  const ENCODER_COUNT = 5;
  const encoderValues = [50, 50, 50, 50, 50];

  function renderEncoder(i) {
    const knob = document.getElementById(`encoder${i}`);
    const val = document.getElementById(`encoderVal${i}`);
    if (!knob) return;
    const pct = encoderValues[i];
    const angle = (pct / 100) * 270 - 135; // -135deg..+135deg, come un encoder reale
    knob.style.setProperty('--enc-angle', `${angle}deg`);
    if (val) val.textContent = Math.round(pct);
    drawStage();
  }

  function attachEncoderEvents(i) {
    const knob = document.getElementById(`encoder${i}`);
    if (!knob) return;
    let dragging = false;
    let lastY = 0;

    function onMove(clientY) {
      const deltaY = lastY - clientY; // trascinare verso l'alto aumenta il valore
      lastY = clientY;
      encoderValues[i] = Math.max(0, Math.min(100, encoderValues[i] + deltaY));
      renderEncoder(i);
    }

    function startDrag(clientY) {
      dragging = true;
      lastY = clientY;
    }

    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      console.log(`Encoder ${i}: fermato a ${Math.round(encoderValues[i])}`);
    }

    knob.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e.clientY); });
    document.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientY); });
    document.addEventListener('mouseup', stopDrag);

    knob.addEventListener('touchstart', (e) => { startDrag(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchmove', (e) => { if (dragging) onMove(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchend', stopDrag);
  }

  function initEncoders() {
    for (let i = 0; i < ENCODER_COUNT; i++) {
      attachEncoderEvents(i);
      renderEncoder(i);
    }
  }

  // --- Grand Master / Sub Master: scale the overall Stage View output --------
  const masterValues = { grand: 100, sub: 100 };

  function renderMaster(key) {
    const track = document.getElementById(`masterTrack${key === 'grand' ? 'Grand' : 'Sub'}`);
    const fill = document.getElementById(`masterFill${key === 'grand' ? 'Grand' : 'Sub'}`);
    const handle = document.getElementById(`masterHandle${key === 'grand' ? 'Grand' : 'Sub'}`);
    const val = document.getElementById(`masterVal${key === 'grand' ? 'Grand' : 'Sub'}`);
    if (!track) return;

    const pct = masterValues[key];
    const trackHeight = track.clientHeight;
    const handleHeight = handle.offsetHeight || 10;
    fill.style.height = `${pct}%`;
    handle.style.bottom = `${(pct / 100) * (trackHeight - handleHeight)}px`;
    val.textContent = `${Math.round(pct)}%`;
    drawStage();
  }

  function attachMasterEvents(key) {
    const suffix = key === 'grand' ? 'Grand' : 'Sub';
    const track = document.getElementById(`masterTrack${suffix}`);
    const handle = document.getElementById(`masterHandle${suffix}`);
    if (!track || !handle) return;
    let dragging = false;

    function onMove(clientY) {
      masterValues[key] = pctFromClientY(track, clientY);
      renderMaster(key);
    }

    function startDrag(clientY) { dragging = true; onMove(clientY); }
    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      console.log(`Master ${key}: fermato a ${Math.round(masterValues[key])}%`);
    }

    handle.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e.clientY); });
    track.addEventListener('mousedown', (e) => { if (e.target === handle) return; startDrag(e.clientY); });
    document.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientY); });
    document.addEventListener('mouseup', stopDrag);

    handle.addEventListener('touchstart', (e) => { startDrag(e.touches[0].clientY); }, { passive: true });
    track.addEventListener('touchstart', (e) => { if (e.target === handle) return; startDrag(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchmove', (e) => { if (dragging) onMove(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchend', stopDrag);
  }

  function initMasters() {
    ['grand', 'sub'].forEach((key) => {
      attachMasterEvents(key);
      renderMaster(key);
    });
  }

  function initExecutorRow() {
    const row = document.getElementById('executorRow');
    if (!row) return;
    row.innerHTML = '';

    for (let i = 0; i < NUM_FADERS; i++) {
      const btn = document.createElement('button');
      btn.className = 'exec-btn';
      btn.textContent = `Flash ${i + 1}`;
      let previous = 0;

      const press = (e) => {
        e.preventDefault();
        previous = state.faders[i];
        state.faders[i] = 100;
        renderFader(i);
      };
      const release = () => {
        state.faders[i] = previous;
        renderFader(i);
      };

      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release);

      row.appendChild(btn);
    }
  }

  // --- Shared effect engine: automated effects usable by cues and by the
  // Effects module, so a cue can "carry" an animated look, not just a static level.
  let effectInterval = null;
  let effectStopTimer = null;

  function stopEffect() {
    if (effectInterval) { clearInterval(effectInterval); effectInterval = null; }
    if (effectStopTimer) { clearTimeout(effectStopTimer); effectStopTimer = null; }
    window.GMA3.currentEffect = null;
    setStatus('Effect stopped');
  }

  function startEffect(type, speedMs = 400, durationMs = 0) {
    stopEffect();
    if (type === 'none') return;
    window.GMA3.currentEffect = type;
    let step = 0;

    effectInterval = setInterval(() => {
      if (type === 'chaser') {
        for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = i === step % NUM_FADERS ? 100 : 0; renderFader(i); }
      } else if (type === 'rainbow') {
        window.GMA3.stageHueShift = ((window.GMA3.stageHueShift || 0) + 18) % 360;
        for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = 70; renderFader(i); }
      } else if (type === 'strobe') {
        const on = step % 2 === 0;
        for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = on ? 100 : 0; renderFader(i); }
      }
      step++;
    }, speedMs);

    setStatus(`Effect running: ${type}`);
    console.log('[effect] Avviato:', type);

    if (durationMs > 0) {
      effectStopTimer = setTimeout(stopEffect, durationMs);
    }
  }

  // --- Stage View: live beam preview on canvas, one beam per channel ----------
  function drawStage() {
    const canvas = document.getElementById('stageCanvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Gli encoder Pan/Tilt/Zoom/Color/Gobo influenzano lo Stage View in diretta:
    // spostano l'origine dei fasci, ne cambiano ampiezza/angolo, ruotano il colore
    // e attivano un pattern "gobo" a bande, cosi' il drag ha un effetto visibile.
    const panOffset = ((encoderValues[0] - 50) / 50) * 40;
    const tiltFactor = (encoderValues[1] - 50) / 50;
    const zoomFactor = 0.6 + (encoderValues[2] / 100) * 1.4;
    const colorHueShift = ((encoderValues[3] - 50) / 50) * 180;
    const goboMode = encoderValues[4] > 50;

    const hueShift = (window.GMA3.stageHueShift || 0) + colorHueShift;
    const hues = state.channelColors.map((h2) => (((h2 + hueShift) % 360) + 360) % 360);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, w, h);

    // Truss: barra scura in alto da cui "pendono" le fixture
    ctx.fillStyle = '#161616';
    ctx.fillRect(0, 0, w, 8);

    // Palco: trapezio in prospettiva sul fondo
    const floorTopY = h * 0.72;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, floorTopY);
    ctx.lineTo(w * 0.88, floorTopY);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const floorGrad = ctx.createLinearGradient(0, floorTopY, 0, h);
    floorGrad.addColorStop(0, '#26262a');
    floorGrad.addColorStop(1, '#08080a');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    const originY = 8;
    const floorY = floorTopY;
    const spacing = w / (NUM_FADERS + 1);
    const masterFactor = (masterValues.grand / 100) * (masterValues.sub / 100);
    const patch = loadPatch();

    for (let i = 0; i < NUM_FADERS; i++) {
      let originX = spacing * (i + 1) + panOffset;
      originX = Math.max(6, Math.min(w - 6, originX));
      const type = (patch[i] && patch[i].type) || 'PAR LED';

      // Corpo fixture sulla truss, sempre visibile anche a canale spento
      ctx.beginPath();
      ctx.arc(originX, originY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();

      const pct = (state.faders[i] / 100) * masterFactor;
      if (pct <= 0) continue;

      const hue = hues[i % hues.length];

      // Il tipo di fixture (dal Patch) cambia forma e comportamento del fascio:
      // Beam/Moving Head Spot = fascio stretto e focalizzato con un "gobo" a
      // terra; Wash = ventaglio ampio e morbido dritto verso il basso;
      // Mirror Ball = scintille sparse; Fog = foschia bassa; Strobe = lampeggio;
      // Blinder = flood ampio e luminoso; il resto = fascio standard.
      if (type === 'Mirror Ball') {
        for (let s = 0; s < 10; s++) {
          const ang = (s / 10) * Math.PI * 2 + (window.GMA3.stageHueShift || 0) * 0.02;
          const dist = 30 + pct * 90;
          const sx = originX + Math.cos(ang) * dist;
          const sy = originY + Math.abs(Math.sin(ang)) * dist * 0.6;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 60%, 85%, ${0.7 * pct})`;
          ctx.fill();
        }
      } else if (type === 'Fog Machine') {
        const hazeGrad = ctx.createRadialGradient(originX, floorY - 10, 4, originX, floorY - 10, 90 + pct * 60);
        hazeGrad.addColorStop(0, `hsla(${hue}, 30%, 70%, ${0.18 * pct})`);
        hazeGrad.addColorStop(1, 'hsla(0, 0%, 70%, 0)');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(originX - 150, floorY - 60, 300, 90);
      } else if (type === 'Strobe') {
        const flashOn = Math.floor(Date.now() / 120) % 3 === 0;
        if (flashOn) {
          ctx.fillStyle = `hsla(${hue}, 20%, 95%, ${0.5 * pct})`;
          ctx.fillRect(0, originY, w, floorY - originY);
        }
      } else {
        const isWash = /Wash|PAR LED|LED Bar|Fresnel/.test(type);
        const isBeam = /Beam|Moving Head Spot|Profile\/Spot/.test(type);
        const isBlinder = type === 'Blinder';

        let spread;
        let targetX;
        if (isBlinder) {
          spread = (140 + pct * 60) * zoomFactor;
          targetX = originX;
        } else if (isWash) {
          spread = (60 + pct * 70) * zoomFactor;
          targetX = originX + tiltFactor * 15;
        } else if (isBeam) {
          spread = (14 + pct * 16) * zoomFactor;
          targetX = originX + (i % 2 === 0 ? -1 : 1) * (16 + pct * 26) + tiltFactor * 30;
        } else {
          spread = (26 + pct * 40) * zoomFactor;
          targetX = originX + (i % 2 === 0 ? -1 : 1) * (10 + pct * 20) + tiltFactor * 30;
        }

        const gradient = ctx.createLinearGradient(originX, originY, targetX, floorY);
        const peakAlpha = isBlinder ? 0.55 : isWash ? 0.22 : 0.4;
        if (goboMode) {
          gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, ${peakAlpha * pct})`);
          gradient.addColorStop(0.35, `hsla(${hue}, 90%, 70%, ${0.08 * pct})`);
          gradient.addColorStop(0.6, `hsla(${hue}, 90%, 70%, ${peakAlpha * 0.7 * pct})`);
          gradient.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
        } else {
          gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, ${peakAlpha * pct})`);
          gradient.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
        }

        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(targetX - spread / 2, floorY);
        ctx.lineTo(targetX + spread / 2, floorY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Beam/Moving Head: macchia gobo netta a terra dove atterra il fascio,
        // cosi' si vede il "disegno" lasciato sul palco.
        if (isBeam) {
          ctx.beginPath();
          ctx.arc(targetX, floorY - 4, 5 + pct * 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 95%, 80%, ${0.8 * pct})`;
          ctx.fill();
        }
      }

      ctx.beginPath();
      ctx.arc(originX, originY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue}, 90%, 75%)`;
      ctx.fill();
    }
  }

  // --- Screen tabs (Pools / Executor) --------------------------------------
  function switchToTab(target) {
    const btn = document.querySelector(`.tab-btn[data-tab="${target}"]`);
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.hidden = pane.dataset.pane !== target;
    });
    console.log('[tabs] Switched to', target);
  }

  function initScreenTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
    });
  }

  // --- Side rails: left = global tool icons, right = numbered section shortcuts
  function initSideRails() {
    document.querySelectorAll('.side-rail-left .rail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        console.log('[rail-left]', action);
        if (action === 'setup') switchToTab('setup');
        else if (action === 'tutorial') document.getElementById('tutorialToggle')?.click();
        else if (action === 'theme') document.getElementById('darkModeToggle')?.click();
        else if (action === 'pools' || action === 'patch' || action === 'stage') switchToTab(action);
        else toast(`"${action}" is not implemented in this trainer`, 'info');
      });
    });

    document.querySelectorAll('.side-rail-right .rail-num-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        switchToTab(target);
        toast(`Section: ${btn.textContent.trim()}`, 'info');
      });
    });
  }

  // --- Section settings modal: clicking a pool-title opens a generic settings panel,
  // like clicking a window header opens its options in the real software.
  function openSectionSettings(title) {
    const overlay = document.getElementById('tutorialOverlay');
    const text = document.getElementById('tutorialText');
    const counter = document.getElementById('tutorialCounter');
    if (!overlay || !text) return;
    text.textContent = `Settings for "${title}" are not implemented in this trainer - this is a placeholder panel, like clicking a window header in the real software.`;
    if (counter) counter.textContent = '';
    overlay.style.display = 'flex';
  }

  // Delegazione su document: i moduli creano i loro .pool-title dopo l'init
  // di app.js, quindi un listener diretto per elemento li perderebbe.
  function initSectionSettings() {
    document.addEventListener('click', (e) => {
      const titleEl = e.target.closest('.pool-title');
      if (!titleEl || e.target.closest('.help')) return;
      openSectionSettings(titleEl.textContent.replace('?', '').trim());
    });
  }

  // --- Init ----------------------------------------------------------------
  function init() {
    console.log('Simulation GM3 Training System: inizializzazione app.js');
    initTheme();
    buildFaders();
    initPatch();
    initDesignTab();
    initSetupPage();
    seedDemoScenes();
    renderScenes();
    initSupabase().then(loadCues);
    initCommandLine();
    initKeypad();
    initTutorial();
    initScreenTabs();
    initSideRails();
    initSectionSettings();
    initExecutorRow();
    initEncoders();
    initMasters();
    drawStage();
    setInterval(drawStage, 150); // anima Strobe/Mirror Ball anche senza toccare fader/encoder
    tickClock();
    setInterval(tickClock, 1000);

    const cueForm = document.getElementById('cueForm');
    if (cueForm) {
      cueForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cueName').value;
        const fadeTime = parseFloat(document.getElementById('cueFadeTime').value) || 0;
        const effect = document.getElementById('cueEffect').value;
        createCue(name, fadeTime, effect);
        cueForm.reset();
        document.getElementById('cueFadeTime').value = 3;
      });
    }

    const saveSceneBtn = document.getElementById('saveSceneBtn');
    if (saveSceneBtn) {
      saveSceneBtn.addEventListener('click', () => {
        const input = document.getElementById('sceneName');
        saveScene(input.value);
        input.value = '';
      });
    }

    const resetDemoBtn = document.getElementById('resetDemoBtn');
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener('click', () => {
        saveScenesToStorage([]);
        seedDemoScenes(true);
        toast('Demo scenes reloaded', 'success');
      });
    }

    setStatus('System ready.');
  }

  // Espone API condivisa ai moduli
  window.GMA3.state = state;
  window.GMA3.toast = toast;
  window.GMA3.setStatus = setStatus;
  window.GMA3.apiRequest = apiRequest;
  window.GMA3.loadScenesFromStorage = loadScenesFromStorage;
  window.GMA3.saveScenesToStorage = saveScenesToStorage;
  window.GMA3.renderFader = renderFader;
  window.GMA3.NUM_FADERS = NUM_FADERS;
  window.GMA3.runCommand = runCommand;
  window.GMA3.startEffect = startEffect;
  window.GMA3.stopEffect = stopEffect;
  window.GMA3.drawStage = drawStage;

  document.addEventListener('DOMContentLoaded', init);
})();
