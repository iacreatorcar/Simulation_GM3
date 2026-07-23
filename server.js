// server.js - GrandMA3 Training System backend
// Server Express con API REST per gestione Cue, Scene e stato DMX in memoria.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Logging middleware -------------------------------------------------
// Logga ogni richiesta con timestamp, metodo, url e tempo di risposta.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// --- Storage in memoria ---------------------------------------------------
// Nessun database: i dati vivono finche' il server e' acceso.
// Il client usa comunque localStorage per persistenza lato browser.
let cues = [];
let nextId = 1;

// --- Helper ---------------------------------------------------------------
function findCue(id) {
  return cues.find((c) => String(c.id) === String(id));
}

function validateCuePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push('Missing or invalid body');
    return errors;
  }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Field "name" is required (non-empty string)');
  }
  if (body.faders !== undefined && !Array.isArray(body.faders)) {
    errors.push('Field "faders" must be an array');
  }
  return errors;
}

// --- API: Cue ---------------------------------------------------------------

// POST /api/cue/create - crea una nuova cue
app.post('/api/cue/create', (req, res) => {
  try {
    const errors = validateCuePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    const ALLOWED_EFFECTS = ['none', 'chaser', 'rainbow', 'strobe'];
    const requestedEffect = typeof req.body.effect === 'string' ? req.body.effect : 'none';

    const cue = {
      id: nextId++,
      name: req.body.name.trim(),
      faders: req.body.faders || [],
      fadeTime: typeof req.body.fadeTime === 'number' ? req.body.fadeTime : 3,
      effect: ALLOWED_EFFECTS.includes(requestedEffect) ? requestedEffect : 'none',
      createdAt: new Date().toISOString()
    };

    cues.push(cue);
    console.log(`Cue creata: #${cue.id} "${cue.name}"`);
    res.status(201).json({ success: true, cue });
  } catch (err) {
    console.error('Errore creazione cue:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/cue/list - restituisce tutte le cue
app.get('/api/cue/list', (req, res) => {
  try {
    res.json({ success: true, count: cues.length, cues });
  } catch (err) {
    console.error('Errore lista cue:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/cue/:id - restituisce una singola cue
app.get('/api/cue/:id', (req, res) => {
  try {
    const cue = findCue(req.params.id);
    if (!cue) {
      return res.status(404).json({ success: false, error: `Cue ${req.params.id} not found` });
    }
    res.json({ success: true, cue });
  } catch (err) {
    console.error('Errore lettura cue:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/cue/:id - elimina una cue
app.delete('/api/cue/:id', (req, res) => {
  try {
    const idx = cues.findIndex((c) => String(c.id) === String(req.params.id));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: `Cue ${req.params.id} not found` });
    }
    const [removed] = cues.splice(idx, 1);
    console.log(`Cue eliminata: #${removed.id} "${removed.name}"`);
    res.json({ success: true, removed });
  } catch (err) {
    console.error('Errore eliminazione cue:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// --- Health check -----------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

// --- 404 handler ------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.originalUrl}` });
});

// --- Error handler globale ---------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err.stack || err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GrandMA3 Training System avviato su http://localhost:${PORT}`);
});
