// module-effects.js - Effetti automatizzati (Chaser/Rainbow/Strobe) e preset colore
// Usa il motore condiviso window.GMA3.startEffect/stopEffect (lo stesso che
// alimenta l'effetto automatico agganciato alle cue).
(function () {
  'use strict';

  const COLOR_PRESETS = [
    { name: 'Red', hue: 0 },
    { name: 'Amber', hue: 30 },
    { name: 'Yellow', hue: 55 },
    { name: 'Green', hue: 120 },
    { name: 'Cyan', hue: 180 },
    { name: 'Blue', hue: 220 },
    { name: 'Violet', hue: 270 },
    { name: 'Magenta', hue: 320 }
  ];

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const swatches = COLOR_PRESETS.map((c) => `
      <button class="color-swatch" data-hue="${c.hue}" title="${c.name}" style="background:hsl(${c.hue},80%,55%)"></button>
    `).join('');

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelEffects';
    section.innerHTML = `
      <div class="pool-title">Effects <span class="help" data-tip="Automated effects run on the fader bank and reflect live on Stage View. Same engine used by cues with an assigned effect.">?</span></div>
      <div class="scene-actions">
        <label>Speed (ms) <input type="number" id="fxSpeed" value="400" min="50" step="50" style="width:80px"></label>
        <button class="btn" id="fxChaser">Chaser</button>
        <button class="btn" id="fxRainbow">Rainbow</button>
        <button class="btn" id="fxStrobe">Strobe</button>
        <button class="btn" id="fxStop">Stop</button>
      </div>
      <div class="color-swatch-row">${swatches}</div>
    `;
    root.appendChild(section);

    document.getElementById('fxChaser').addEventListener('click', () => runFx('chaser'));
    document.getElementById('fxRainbow').addEventListener('click', () => runFx('rainbow'));
    document.getElementById('fxStrobe').addEventListener('click', () => runFx('strobe'));
    document.getElementById('fxStop').addEventListener('click', () => window.GMA3.stopEffect());

    section.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.GMA3.stageHueShift = parseInt(btn.dataset.hue, 10);
        window.GMA3.drawStage();
        console.log('[module-effects] Stage hue set to', btn.dataset.hue);
        window.GMA3.toast(`Stage color set: ${btn.title}`, 'info');
      });
    });
  }

  function runFx(type) {
    const speed = parseInt(document.getElementById('fxSpeed').value, 10) || 400;
    window.GMA3.startEffect(type, speed);
    console.log('[module-effects] Effetto avviato:', type, speed);
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
