// module-timecode.js - Timecode con sequenza automatica: al Play scorre un
// cronometro e a tempi prestabiliti richiama scene o effetti, come il
// modulo Timecode di una console reale.
(function () {
  'use strict';

  // Sequenza dimostrativa: al secondo N esegue un'azione.
  // "scene" cerca una scena salvata per nome (vedi samples/default-scenes.json),
  // "effect" avvia un effetto automatizzato tramite il motore condiviso.
  const SEQUENCE = [
    { time: 0, label: 'Blackout', type: 'command', value: 'OFF' },
    { time: 3, label: 'Scene: Full Stage Wash', type: 'scene', value: 'Full Stage Wash' },
    { time: 8, label: 'Scene: Warm Center Spot', type: 'scene', value: 'Warm Center Spot' },
    { time: 13, label: 'Effect: Chaser', type: 'effect', value: 'chaser' },
    { time: 20, label: 'Scene: Cool Side Wash', type: 'scene', value: 'Cool Side Wash' },
    { time: 26, label: 'Effect: Rainbow', type: 'effect', value: 'rainbow' },
    { time: 32, label: 'Scene: Blackout', type: 'scene', value: 'Blackout' }
  ];

  let tickInterval = null;
  let elapsedMs = 0;
  let firedIndex = 0;

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const rows = SEQUENCE.map((step, i) => `
      <li id="tcStep${i}"><span class="tc-time">${formatTime(step.time * 1000)}</span><span class="tc-label">${step.label}</span></li>
    `).join('');

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelTimecode';
    section.innerHTML = `
      <div class="pool-title">Timecode <span class="help" data-tip="Play runs a clock and fires the sequence below at each listed time. Reset rewinds to 00:00.">?</span></div>
      <div class="tc-clock" id="tcClock">00:00.0</div>
      <div class="scene-actions">
        <button class="btn" id="tcPlay">Play</button>
        <button class="btn" id="tcPause">Pause</button>
        <button class="btn" id="tcReset">Reset</button>
      </div>
      <ul class="tc-sequence" id="tcSequence">${rows}</ul>
    `;
    root.appendChild(section);

    document.getElementById('tcPlay').addEventListener('click', play);
    document.getElementById('tcPause').addEventListener('click', pause);
    document.getElementById('tcReset').addEventListener('click', reset);
  }

  function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const m = Math.floor(totalSeconds / 60);
    const s = (totalSeconds % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  function findSceneByName(name) {
    const scenes = window.GMA3.loadScenesFromStorage();
    return scenes.find((s) => s.name === name);
  }

  function runStep(step, index) {
    console.log('[timecode] Fired step', index, step);
    const { state, NUM_FADERS, renderFader, toast, runCommand, startEffect } = window.GMA3;

    if (step.type === 'command') {
      runCommand(step.value);
    } else if (step.type === 'scene') {
      const scene = findSceneByName(step.value);
      if (scene) {
        for (let i = 0; i < NUM_FADERS; i++) {
          state.faders[i] = scene.faders[i] ?? 0;
          renderFader(i);
        }
        toast(`Timecode: recalled "${step.value}"`, 'success');
      } else {
        toast(`Timecode: scene "${step.value}" not found - import samples/default-scenes.json first`, 'error');
      }
    } else if (step.type === 'effect') {
      startEffect(step.value, 400, 0);
      toast(`Timecode: effect "${step.value}" started`, 'success');
    }

    const li = document.getElementById(`tcStep${index}`);
    if (li) li.classList.add('tc-fired');
  }

  function play() {
    if (tickInterval) return;
    console.log('[timecode] Play');
    tickInterval = setInterval(() => {
      elapsedMs += 100;
      const clock = document.getElementById('tcClock');
      if (clock) clock.textContent = formatTime(elapsedMs);

      while (firedIndex < SEQUENCE.length && elapsedMs >= SEQUENCE[firedIndex].time * 1000) {
        runStep(SEQUENCE[firedIndex], firedIndex);
        firedIndex++;
      }

      if (firedIndex >= SEQUENCE.length) pause();
    }, 100);
  }

  function pause() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
      console.log('[timecode] Pause');
    }
  }

  function reset() {
    pause();
    elapsedMs = 0;
    firedIndex = 0;
    const clock = document.getElementById('tcClock');
    if (clock) clock.textContent = '00:00.0';
    document.querySelectorAll('.tc-fired').forEach((el) => el.classList.remove('tc-fired'));
    console.log('[timecode] Reset');
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
