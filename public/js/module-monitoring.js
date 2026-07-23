// module-monitoring.js - Monitoraggio DMX in tempo reale (valori canali correnti)
(function () {
  'use strict';

  let monitorInterval = null;

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelMonitoring';
    section.innerHTML = `
      <div class="pool-title">DMX Monitor <span class="help" data-tip="Shows the live DMX value (0-255) of every channel, refreshed every 500ms.">?</span></div>
      <pre id="dmxOutput" style="font-size:0.75rem; max-height:160px; overflow-y:auto; margin:0;"></pre>
    `;
    root.appendChild(section);

    monitorInterval = setInterval(renderMonitor, 500);
    renderMonitor();
  }

  function renderMonitor() {
    const out = document.getElementById('dmxOutput');
    if (!out || !window.GMA3 || !window.GMA3.state) return;

    const { state, NUM_FADERS } = window.GMA3;
    const lines = [];
    for (let i = 0; i < NUM_FADERS; i++) {
      const dmxValue = Math.round((state.faders[i] / 100) * 255);
      lines.push(`CH${String(i + 1).padStart(2, '0')}: ${String(dmxValue).padStart(3, '0')} | ${'#'.repeat(Math.round(dmxValue / 10))}`);
    }
    out.textContent = lines.join('\n');
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
