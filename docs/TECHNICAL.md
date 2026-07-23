# Technical Reference - GrandMA3 Training System

## Architecture

```
Browser (public/)                    Server (server.js)
┌─────────────────────┐              ┌─────────────────────┐
│ index.html           │              │ Express app          │
│  ├── app.js (core)    │──fetch()──▶ │  ├── /api/cue/*       │
│  ├── module-*.js (x7) │◀──JSON──── │  ├── /api/health      │
│  └── style.css        │              │  └── static file server│
└─────────────────────┘              └─────────────────────┘
        │
        ▼
   localStorage (scenes, theme)
```

- The **server** only owns Cue data. It is stateless per request but keeps an in-memory array (`cues`) that resets on restart.
- The **client** owns Fader state (`window.GMA3.state.faders`) and Scene data, persisted entirely in `localStorage` — the server never sees scenes.
- Every module (`module-*.js`) is an independent IIFE that reads/writes the shared `window.GMA3` namespace and injects its own `<section class="pool-window">` into `#modulesRoot`.

## Data flow

### Fader change (drag/click)
```
pointer event → pctFromClientY() → state.faders[i] updated → renderFader(i) repaints DOM
```
No network call. Pure client-side, O(1) per event, no debounce needed (paints are cheap DOM writes).

### Cue create
```
form submit → createCue() → POST /api/cue/create → server validates → 201 + cue → loadCues() → GET /api/cue/list → renderCueList()
```

### Scene save/recall
```
saveScene() → localStorage.setItem() → renderScenes()
loadScene(id) → localStorage.getItem() → state.faders = scene.faders → renderFader() loop
```

### Command line
```
Enter/Execute → runCommand(text) → regex/keyword match → mutates state.faders[] (respects state.selectedChannels if set) → renderFader() loop
```

### Automation module
```
setInterval(N seconds) → loadScenesFromStorage() → pick scene[index % length] → applyScene() → renderFader() loop
```

## REST API

See [API.md](API.md) for full request/response shapes. Summary:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/cue/create` | Create a cue |
| GET | `/api/cue/list` | List all cues |
| GET | `/api/cue/:id` | Read one cue |
| DELETE | `/api/cue/:id` | Delete a cue |

All responses: `{ success: boolean, ...payload }`. Errors: `{ success: false, error | errors }`.

## Serverless considerations

**Update: this has been done.** Cue persistence no longer depends on the Express in-memory array — `app.js` talks to **Supabase directly from the browser** (via the `@supabase/supabase-js` CDN client, see [API.md](API.md#supabase-integration)), with a Postgres table (`supabase/schema.sql`) and a Realtime subscription so every open session sees cues created/deleted elsewhere instantly.

The old `/api/cue/*` Express routes still exist as an **in-memory fallback**, used automatically when `.env` (`SUPABASE_URL`/`SUPABASE_ANON_KEY`) is missing — useful for offline development, but not durable.

Practical effect for deployment:

1. The static frontend (`public/`) can now be hosted anywhere static (Vercel, Netlify, GitHub Pages) with no server process at all, since cue persistence lives in Supabase, not in `server.js`.
2. If `server.js` is kept (e.g. for the `/api/config` endpoint and the legacy fallback routes), it can still run as a single small Node process or be adapted into serverless functions per platform — it no longer needs to be stateful for cues to work.
3. `console.log` logging should be replaced with the platform's structured logging if moved to a serverless runtime.

Scenes/Patch/Design remain entirely client-side (`localStorage`), unaffected by any of this.

## Performance

- 16 faders, DOM writes are `style.height`/`style.bottom`/`textContent` only — no layout thrashing, comfortably sustains 60fps drag.
- `module-monitoring.js` polls state every 500ms via `setInterval`, cheap (16 numeric reads + string join).
- Supabase Realtime uses a single websocket channel per session; cue list re-fetches on each event rather than diffing, acceptable at demo scale (a handful of cues, a few concurrent sessions).
- No frameworks, no virtual DOM diffing, no bundler — first paint is a single HTML/CSS/JS request per file (plus the Supabase CDN script).
