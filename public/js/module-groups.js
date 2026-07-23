// module-groups.js - Gestione gruppi di canali (selezione multipla e comandi di gruppo)
(function () {
  'use strict';

  const groups = {}; // { nomeGruppo: [indici canali] }

  function createPanel() {
    const root = document.getElementById('modulesRoot');
    if (!root) return;

    const section = document.createElement('section');
    section.className = 'pool-window';
    section.id = 'panelGroups';
    section.innerHTML = `
      <div class="pool-title">Group Pool <span class="help" data-tip="Create a group listing channels separated by commas (e.g. 1,2,3), then set its level.">?</span></div>
      <div class="scene-actions">
        <input type="text" id="grpName" placeholder="Group name">
        <input type="text" id="grpChannels" placeholder="Channels e.g. 1,2,3">
        <button class="btn" id="grpCreate">Store Group</button>
      </div>
      <ul id="grpList" class="cue-list"></ul>
    `;
    root.appendChild(section);

    document.getElementById('grpCreate').addEventListener('click', () => {
      const name = document.getElementById('grpName').value.trim();
      const chansRaw = document.getElementById('grpChannels').value.trim();
      if (!name || !chansRaw) {
        window.GMA3.toast('Name and channels are required', 'error');
        return;
      }
      const indices = chansRaw.split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => !Number.isNaN(n) && n >= 0 && n < window.GMA3.NUM_FADERS);

      if (!indices.length) {
        window.GMA3.toast('No valid channels', 'error');
        return;
      }

      groups[name] = indices;
      console.log('[module-groups] Gruppo creato:', name, indices);
      window.GMA3.toast(`Group "${name}" created (${indices.length} channels)`, 'success');
      renderGroups();
    });
  }

  function renderGroups() {
    const list = document.getElementById('grpList');
    list.innerHTML = '';
    Object.keys(groups).forEach((name) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${name}: [${groups[name].map((i) => i + 1).join(', ')}]</span>
        <span>
          <button class="onBtn">100%</button>
          <button class="offBtn">0%</button>
          <button class="delBtn">X</button>
        </span>
      `;
      li.querySelector('.onBtn').addEventListener('click', () => setGroupLevel(name, 100));
      li.querySelector('.offBtn').addEventListener('click', () => setGroupLevel(name, 0));
      li.querySelector('.delBtn').addEventListener('click', () => {
        delete groups[name];
        renderGroups();
      });
      list.appendChild(li);
    });
  }

  function setGroupLevel(name, level) {
    const { state, renderFader, toast } = window.GMA3;
    groups[name].forEach((i) => {
      state.faders[i] = level;
      renderFader(i);
    });
    toast(`Group "${name}" set to ${level}%`, 'success');
    console.log('[module-groups] Gruppo', name, 'settato a', level);
  }

  document.addEventListener('DOMContentLoaded', createPanel);
})();
