// module-advance.js - Funzionalita' avanzate (blackout, full, freeze)
(function () {
  'use strict';

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelAdvance';
    section.innerHTML = `
      <div class="pool-title">Advanced <span class="help" data-tip="Quick commands: Blackout zeroes all faders, Full sets them to 100%.">?</span></div>
      <div class="scene-actions">
        <button class="btn" id="advBlackout">Blackout</button>
        <button class="btn" id="advFull">Full</button>
        <button class="btn" id="advFreeze">Freeze</button>
      </div>
      <div id="advStatus" style="margin-top:8px;font-size:0.8rem;"></div>
    `;
    root.appendChild(section);

    let frozen = false;

    document.getElementById('advBlackout').addEventListener('click', () => {
      const { state, NUM_FADERS, renderFader, toast } = window.GMA3;
      for (let i = 0; i < NUM_FADERS; i++) {
        state.faders[i] = 0;
        renderFader(i);
      }
      toast('Blackout executed', 'success');
      console.log('[module-advance] Blackout eseguito');
    });

    document.getElementById('advFull').addEventListener('click', () => {
      const { state, NUM_FADERS, renderFader, toast } = window.GMA3;
      for (let i = 0; i < NUM_FADERS; i++) {
        state.faders[i] = 100;
        renderFader(i);
      }
      toast('Full applied', 'success');
      console.log('[module-advance] Full eseguito');
    });

    document.getElementById('advFreeze').addEventListener('click', () => {
      frozen = !frozen;
      const el = document.getElementById('advStatus');
      el.textContent = frozen ? 'Status: FROZEN' : '';
      window.GMA3.toast(frozen ? 'Freeze enabled' : 'Freeze disabled', 'info');
      console.log('[module-advance] Freeze:', frozen);
    });
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
