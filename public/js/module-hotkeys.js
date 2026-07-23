// module-hotkeys.js - Scorciatoie da tastiera per le azioni piu' comuni
(function () {
  'use strict';

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelHotkeys';
    section.innerHTML = `
      <div class="pool-title">Hotkeys <span class="help" data-tip="Shortcuts active globally on the page.">?</span></div>
      <ul class="cue-list">
        <li><span>B</span><span>Blackout</span></li>
        <li><span>F</span><span>Full</span></li>
        <li><span>S</span><span>Focus Store Scene field</span></li>
        <li><span>D</span><span>Toggle theme</span></li>
        <li><span>1-8</span><span>Focus fader channel N</span></li>
      </ul>
    `;
    root.appendChild(section);

    document.addEventListener('keydown', handleKey);
  }

  function handleKey(e) {
    // Ignora se l'utente sta scrivendo in un campo di input
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const { state, NUM_FADERS, renderFader, toast } = window.GMA3 || {};
    if (!state) return;

    const key = e.key.toLowerCase();

    if (key === 'b') {
      for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = 0; renderFader(i); }
      toast('Hotkey: Blackout', 'info');
      console.log('[module-hotkeys] B -> blackout');
    } else if (key === 'f') {
      for (let i = 0; i < NUM_FADERS; i++) { state.faders[i] = 100; renderFader(i); }
      toast('Hotkey: Full', 'info');
      console.log('[module-hotkeys] F -> full');
    } else if (key === 's') {
      const input = document.getElementById('sceneName');
      if (input) input.focus();
      console.log('[module-hotkeys] S -> focus salva scena');
    } else if (key === 'd') {
      document.getElementById('darkModeToggle')?.click();
      console.log('[module-hotkeys] D -> toggle tema');
    } else if (/^[1-8]$/.test(key)) {
      const idx = parseInt(key, 10) - 1;
      document.getElementById(`faderTrack${idx}`)?.focus();
      console.log('[module-hotkeys] Focus fader', idx + 1);
    }
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
