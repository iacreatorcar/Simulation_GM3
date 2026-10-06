# Developer Guide - Simulation GM3 Training System

## Stack

- Backend: Node.js + Express (no DB, in-memory storage)
- Frontend: HTML5 + CSS3 + Vanilla JS (zero dependencies, no framework)
- Theme: green terminal (`#0f0` on `#000`), light variant via `data-theme`
- Layout: mimics a professional moving-light console — pool windows on screen, command line + playback strip at the bottom

## Project structure

```
grandma3-project/
├── server.js              # Express app + REST API
├── package.json
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js              # core: faders, cue API, scene localStorage, toast, theme, command line
│       ├── module-advance.js   # blackout/full/freeze
│       ├── module-effects.js   # chaser
│       ├── module-groups.js    # channel groups
│       ├── module-automation.js# automatic scene playback
│       ├── module-monitoring.js# live DMX monitor
│       ├── module-export.js    # JSON export/import
│       └── module-hotkeys.js   # keyboard shortcuts
└── docs/
    ├── API.md
    ├── USAGE.md
    └── DEVELOPMENT.md
```

## Conventions

- Every JS module is an IIFE (`(function(){...})()`) loaded as a classic script (no bundler, no `type="module"`, for simple load ordering).
- Shared state and helpers are exposed on `window.GMA3` by `app.js`:
  - `state.faders` — array of values 0-100
  - `state.selectedChannels` — channels selected via the command line (0-based)
  - `renderFader(i)` — redraws fader i after changing `state.faders[i]`
  - `toast(msg, type)` — UI notification (`type`: `'success' | 'error' | 'info'`)
  - `setStatus(text)` — updates the status bar
  - `apiRequest(url, options)` — fetch wrapper with error handling
  - `loadScenesFromStorage()` / `saveScenesToStorage(scenes)` — scene persistence
  - `runCommand(text)` — command line parser (FULL, OFF, AT n, CLEAR)
  - `NUM_FADERS` — channel count (8)
- Each module registers itself into `#modulesRoot` on `DOMContentLoaded`, creating its own `<section class="pool-window">`.
- Code comments are in Italian by project convention; UI-facing strings (labels, tooltips, toasts) are in English.

## Adding a new module

1. Create `public/js/module-name.js` following the existing IIFE pattern.
2. Use `window.GMA3` to read/update shared state — don't duplicate fader state locally.
3. Add `<script src="js/module-name.js"></script>` in `index.html` after `app.js`.
4. Log key actions with `console.log('[module-name] ...')` for debugging.

## Extending the API

Cues live in memory (`server.js`, `cues` array). For real persistence, replace the array with a DB (e.g. SQLite/lowdb) while keeping the same response shape (`{ success, ... }`) so the frontend doesn't break.

Every new route must:
- validate input (see `validateCuePayload` as an example)
- use try/catch and respond with `{ success: false, error }` on failure
- log the action with `console.log`

## Manual testing

```bash
npm install
npm start
```

Then verify:
- `curl http://localhost:3000/api/health`
- Cue create/list/delete from the UI and from `curl`
- Fader drag (mouse and touch/responsive mode in DevTools)
- Command line: `FULL`, `OFF`, `AT 50`, `CLEAR`
- Save a scene → reload the page → scene still present (localStorage)
- Export scenes → downloaded `.json` file → Import → scenes restored
