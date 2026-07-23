// module-export.js - Export/Import scene in formato JSON (file su disco)
(function () {
  'use strict';

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelExport';
    section.innerHTML = `
      <div class="pool-title">Export/Import <span class="help" data-tip="Export all stored scenes to a .json file, or import one to restore them.">?</span></div>
      <div class="scene-actions">
        <button class="btn" id="exportBtn">Export Scenes</button>
        <label class="btn" for="importInput">Import Scenes</label>
        <input type="file" id="importInput" accept="application/json" style="display:none">
      </div>
    `;
    root.appendChild(section);

    document.getElementById('exportBtn').addEventListener('click', exportScenes);
    document.getElementById('importInput').addEventListener('change', importScenes);
  }

  function exportScenes() {
    const { loadScenesFromStorage, toast } = window.GMA3;
    const scenes = loadScenesFromStorage();
    const blob = new Blob([JSON.stringify(scenes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gma3-scenes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${scenes.length} scene(s) exported`, 'success');
    console.log('[module-export] Export completato,', scenes.length, 'scene');
  }

  function importScenes(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error('Invalid format: expected an array of scenes');

        const { loadScenesFromStorage, saveScenesToStorage, toast } = window.GMA3;
        const current = loadScenesFromStorage();
        const merged = current.concat(imported);
        saveScenesToStorage(merged);
        toast(`${imported.length} scene(s) imported`, 'success');
        console.log('[module-export] Import completato,', imported.length, 'scene');
        location.reload();
      } catch (err) {
        window.GMA3.toast(`Import failed: ${err.message}`, 'error');
        console.error('[module-export] Errore import:', err);
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
