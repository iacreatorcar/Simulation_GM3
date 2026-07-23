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

The current backend keeps cues in a process-memory array — this does **not** survive serverless cold starts or multiple concurrent instances (e.g. Vercel/Netlify functions, AWS Lambda). To deploy serverless:

1. Replace the in-memory `cues` array with an external store reachable from any invocation: a managed DB (Postgres/Supabase, DynamoDB, Firestore) or a KV store (Redis, Vercel KV).
2. Keep the route handlers' shape identical (`{ success, cue }`, `{ success, cues }`, etc.) so `app.js`'s `apiRequest()` wrapper needs no changes.
3. `express.static` serving of `public/` can be replaced by the platform's static asset hosting; only the `/api/*` routes need to run as functions.
4. `console.log` logging should be replaced with the platform's structured logging (stdout is usually captured automatically, so minimal change needed).

No frontend code depends on the server being stateful — scenes already live entirely in the browser, so a serverless migration only affects the Cue Pool feature.

## Performance

- 8 faders, DOM writes are `style.height`/`style.bottom`/`textContent` only — no layout thrashing, comfortably sustains 60fps drag.
- `module-monitoring.js` polls state every 500ms via `setInterval`, cheap (8 numeric reads + string join).
- No frameworks, no virtual DOM diffing, no bundler — first paint is a single HTML/CSS/JS request per file.
