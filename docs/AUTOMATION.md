# Automation Guide - Connecting to QLab / QL5

This training system currently runs standalone (in-browser fader/scene/cue state, no external protocol output). This guide covers what's needed to bridge it to real show-control software such as **QLab** (Figure 53) or a **QL5**-class OSC-capable device/mixer, so that cues/scenes triggered here can drive real playback elsewhere.

## Why OSC

Both QLab and most modern consoles/mixers (including OSC-capable QL-series devices) accept **OSC (Open Sound Control)** messages over UDP. It's the natural bridge because:
- It's a simple, well-documented UDP protocol (no vendor SDK required).
- QLab listens for OSC commands out of the box (Workspace Settings → OSC Controls).
- Professional consoles can send/receive OSC, so the same bridge concept extends to a real console later.

## What this app is missing today

`server.js` and `app.js` only handle HTTP/JSON and `localStorage` — there's no OSC/UDP socket anywhere in the stack. To automate QLab/QL5 you need to add a small OSC bridge. Node has good UDP support via the built-in `dgram` module (or the `osc` npm package for message encoding).

## Recommended integration path

1. **Add an OSC client dependency** (server-side only, keeps the frontend dependency-free):
   ```bash
   npm install osc
   ```

2. **Extend `server.js`** with an OSC UDP client pointed at QLab's OSC input port (default `53000`):
   ```js
   const osc = require('osc');
   const qlabPort = new osc.UDPPort({
     remoteAddress: '127.0.0.1', // QLab machine IP
     remotePort: 53000
   });
   qlabPort.open();
   ```

3. **Trigger cues on cue/scene events.** When a cue is created or a scene is recalled in this app, send a matching OSC message, e.g.:
   ```js
   qlabPort.send({
     address: '/cue/1/start' // or /go, depending on your QLab cue numbering
   });
   ```
   Hook this into the existing `POST /api/cue/create` handler (`server.js`) or add a new `POST /api/cue/:id/fire` route that both marks the cue as active and fires the OSC message.

4. **For QL-series OSC-capable mixers**, the exact address pattern depends on the device's OSC implementation (check its manual — typically something like `/ql5/scene/recall/<n>` or channel-level `/ql5/ch/<n>/fader`). Map this app's `state.faders[i]` (0-100) to the device's expected range (often 0.0-1.0 float or dB) before sending.

5. **Keep the mapping data-driven.** Store a `cue.oscAddress` (or `scene.oscAddress`) field alongside existing cue/scene data so each entry in the Cue Pool / Scene Pool can target a different QLab cue number or console scene, instead of hardcoding addresses in code.

## Suggested message map

| This app | OSC address (example) | Notes |
|---|---|---|
| Cue Pool: create cue #N | `/cue/N/start` | Fires the matching QLab cue number |
| Scene Pool: recall scene | `/cue/<mapped-id>/start` | Map scene id → QLab cue number in a lookup table |
| Command line `FULL` | `/cue/full/start` | Optional: dedicate a QLab "full" cue |
| Command line `OFF`/`BLACKOUT` | `/cue/blackout/start` | Optional: dedicate a QLab blackout cue |
| Automation module tick | same as Scene Pool recall | Automation already calls the scene-recall path internally |

## Testing the bridge

1. Open QLab, go to Workspace Settings → OSC Controls, enable OSC input, confirm port `53000`.
2. Run this app's server with the OSC client added as above.
3. Trigger a cue/scene from the UI and confirm QLab's cue list highlights/fires the matching cue.
4. Use a tool like `oscsend` (from `liblo`) or a Node one-liner with the `osc` package to test messages independently of this app, isolating whether an issue is in the bridge or in QLab's OSC configuration.

## Notes

- This is intentionally kept server-side: the browser frontend has zero dependencies by design, and OSC/UDP isn't available in-browser anyway (no raw UDP sockets in JS running in a browser tab).
- If moving to a serverless deployment (see [TECHNICAL.md](TECHNICAL.md)), the OSC bridge needs a long-lived process (serverless functions can't hold an open UDP socket reliably) — run it as a small standalone Node service alongside the serverless API, not inside a function.
