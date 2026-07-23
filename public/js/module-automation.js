// module-automation.js - Playback automatico delle scene salvate in localStorage
(function () {
  'use strict';

  let autoInterval = null;
  let sceneIndex = 0;

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelAutomation';
    section.innerHTML = `
      <div class="pool-title">Automation <span class="help" data-tip="Automatically loops through stored scenes, one every N seconds.">?</span></div>
      <div class="scene-actions">
        <label>Interval (s) <input type="number" id="autoInterval" value="5" min="1" style="width:70px"></label>
        <button class="btn" id="autoStart">Go</button>
        <button class="btn" id="autoStop">Stop</button>
      </div>
      <div id="autoStatus" style="margin-top:8px;font-size:0.8rem;"></div>
    `;
    root.appendChild(section);

    document.getElementById('autoStart').addEventListener('click', startAutomation);
    document.getElementById('autoStop').addEventListener('click', stopAutomation);
  }

  function startAutomation() {
    stopAutomation();
    const { loadScenesFromStorage, toast } = window.GMA3;
    const scenes = loadScenesFromStorage();
    if (!scenes.length) {
      toast('No stored scenes to play back', 'error');
      return;
    }

    const seconds = parseInt(document.getElementById('autoInterval').value, 10) || 5;
    sceneIndex = 0;

    autoInterval = setInterval(() => {
      const scenes = loadScenesFromStorage();
      if (!scenes.length) { stopAutomation(); return; }
      const scene = scenes[sceneIndex % scenes.length];
      applyScene(scene);
      document.getElementById('autoStatus').textContent = `Playing: ${scene.name}`;
      console.log('[module-automation] Riproduco scena', scene.name);

      // Se il pannello Catalyst e' caricato, fa avanzare anche il layer 1
      // dell'output preview in sincrono con la scena, cosi' l'automazione
      // pilota davvero sia le luci che il media server.
      if (window.GMA3.catalystSetLayer) {
        window.GMA3.catalystSetLayer(0, sceneIndex);
      }

      sceneIndex++;
    }, seconds * 1000);

    toast('Automation started', 'success');
    console.log('[module-automation] Automazione avviata, intervallo', seconds);
  }

  function applyScene(scene) {
    const { state, NUM_FADERS, renderFader } = window.GMA3;
    for (let i = 0; i < NUM_FADERS; i++) {
      state.faders[i] = scene.faders[i] ?? 0;
      renderFader(i);
    }
  }

  function stopAutomation() {
    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      const el = document.getElementById('autoStatus');
      if (el) el.textContent = '';
      console.log('[module-automation] Automazione fermata');
    }
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
