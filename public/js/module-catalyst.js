// module-catalyst.js - Pannello media server:
// layer video assegnabili, opacita', blend mode, preview output composito.
// Puramente decorativo/dimostrativo (nessun video reale), ma la preview
// canvas mostra davvero la composizione dei layer attivi in tempo reale.
(function () {
  'use strict';

  const LAYER_COUNT = 4;
  const BLEND_MODES = ['normal', 'add', 'multiply', 'screen'];

  // Libreria media dimostrativa: nome + colore rappresentativo del clip
  const MEDIA_LIBRARY = [
    { name: 'Fire Loop', color: '#ff5500' },
    { name: 'Smoke Particles', color: '#8899aa' },
    { name: 'Starfield', color: '#3355ff' },
    { name: 'Abstract Waves', color: '#00ccaa' },
    { name: 'Color Wash', color: '#cc33cc' },
    { name: 'Geometric Grid', color: '#ffcc00' },
    { name: 'Rain Loop', color: '#3399ff' },
    { name: 'Lens Flare', color: '#ffffff' }
  ];

  const layers = Array.from({ length: LAYER_COUNT }, () => ({
    media: null,
    opacity: 80,
    blend: 'normal',
    active: true
  }));

  function createPanel() {
    const layersRoot = document.getElementById('catalystLayers');
    const mediaRoot = document.getElementById('catalystMediaList');
    if (!layersRoot || !mediaRoot) return;

    layersRoot.innerHTML = layers.map((layer, i) => `
      <div class="catalyst-layer" id="catalystLayer${i}">
        <div class="catalyst-layer-head">
          <button class="catalyst-toggle on" id="catalystToggle${i}" title="Enable/disable layer">L${i + 1}</button>
          <span class="catalyst-layer-media" id="catalystMediaName${i}">Empty</span>
        </div>
        <label class="catalyst-row">Opacity
          <input type="range" min="0" max="100" value="80" id="catalystOpacity${i}">
          <span id="catalystOpacityVal${i}">80%</span>
        </label>
        <label class="catalyst-row">Blend
          <select id="catalystBlend${i}">
            ${BLEND_MODES.map((b) => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </label>
      </div>
    `).join('');

    mediaRoot.innerHTML = MEDIA_LIBRARY.map((clip) => `
      <li class="catalyst-media-item" data-name="${clip.name}" data-color="${clip.color}">
        <span class="catalyst-media-swatch" style="background:${clip.color}"></span>
        ${clip.name}
      </li>
    `).join('');

    let selectedLayer = 0;

    layers.forEach((layer, i) => {
      document.getElementById(`catalystToggle${i}`).addEventListener('click', () => {
        layer.active = !layer.active;
        document.getElementById(`catalystToggle${i}`).classList.toggle('on', layer.active);
        renderPreview();
      });

      document.getElementById(`catalystOpacity${i}`).addEventListener('input', (e) => {
        layer.opacity = parseInt(e.target.value, 10);
        document.getElementById(`catalystOpacityVal${i}`).textContent = `${layer.opacity}%`;
        renderPreview();
      });

      document.getElementById(`catalystBlend${i}`).addEventListener('change', (e) => {
        layer.blend = e.target.value;
        renderPreview();
      });

      document.getElementById(`catalystLayer${i}`).addEventListener('click', (e) => {
        if (e.target.closest('input, select, button')) return;
        selectedLayer = i;
        layersRoot.querySelectorAll('.catalyst-layer').forEach((el, idx) => el.classList.toggle('selected', idx === i));
      });
    });

    mediaRoot.querySelectorAll('.catalyst-media-item').forEach((item) => {
      item.addEventListener('click', () => {
        const layer = layers[selectedLayer];
        layer.media = { name: item.dataset.name, color: item.dataset.color };
        document.getElementById(`catalystMediaName${selectedLayer}`).textContent = item.dataset.name;
        console.log('[catalyst] Layer', selectedLayer + 1, '->', item.dataset.name);
        window.GMA3.toast(`Layer ${selectedLayer + 1}: ${item.dataset.name}`, 'success');
        renderPreview();
      });
    });

    layersRoot.querySelector('.catalyst-layer').classList.add('selected');
    renderPreview();
  }

  // Compone i layer attivi sulla preview, rispettando opacita' e blend mode -
  // e' l'unica parte realmente "funzionante" del pannello (il resto e' UI).
  function renderPreview() {
    const canvas = document.getElementById('catalystPreview');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const compositeMap = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen' };

    layers.forEach((layer) => {
      if (!layer.active || !layer.media) return;
      ctx.globalCompositeOperation = compositeMap[layer.blend] || 'source-over';
      ctx.globalAlpha = layer.opacity / 100;
      ctx.fillStyle = layer.media.color;
      ctx.fillRect(0, 0, w, h);
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // API pubblica: permette ad altri moduli (es. Automation) di pilotare i
  // layer media server - assegna un clip della libreria a un layer e ridisegna
  // subito la preview, cosi' l'output cambia davvero durante una sequenza.
  function setLayerMediaByIndex(layerIndex, mediaIndex) {
    const layer = layers[layerIndex];
    const clip = MEDIA_LIBRARY[((mediaIndex % MEDIA_LIBRARY.length) + MEDIA_LIBRARY.length) % MEDIA_LIBRARY.length];
    if (!layer || !clip) return;
    layer.media = { name: clip.name, color: clip.color };
    const nameEl = document.getElementById(`catalystMediaName${layerIndex}`);
    if (nameEl) nameEl.textContent = clip.name;
    renderPreview();
    console.log('[catalyst] API: layer', layerIndex + 1, '->', clip.name);
  }

  window.GMA3 = window.GMA3 || {};
  window.GMA3.catalystSetLayer = setLayerMediaByIndex;
  window.GMA3.catalystMediaLibrary = MEDIA_LIBRARY;

  document.addEventListener('DOMContentLoaded', createPanel);
})();
