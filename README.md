<div align="center">

# Simulation GM3

**A browser-based lighting console trainer inspired by the grandMA3 workflow.**

Zero frontend dependencies · Node.js/Express backend · Green-terminal aesthetic

[Features](#features) · [Quick Start](#quick-start) · [Screens](#screens--tabs) · [Documentation](#documentation) · [Architecture](#architecture)

</div>

---

## Overview

Simulation GM3 is a self-contained training console for lighting operators: a compact "hardware" console UI (screen + physical deck), a 16-channel fader bank, a REST-backed cue engine, a live Stage View beam simulator, and a small media-server panel — all running from a single Node process with **no build step and no frontend framework**.

It's built to teach and demonstrate the core mental model of a moving-light console (patch → cue → playback → automation) without needing real hardware or a licensed console application.

## Quick Start

```bash
npm install
npm start
```

Open **http://localhost:3000**. The console fills the viewport (16:9-oriented layout) and works with mouse or touch.

## Features

| Area | What it does |
|---|---|
| **Fader Sheet** | 16 channel faders, drag or click to set intensity (0–100%), mouse + touch |
| **Command Line** | Type `FULL`, `OFF`/`BLACKOUT`, `AT <0-100>`, `CLEAR` — plus a physical on-screen keypad (`AT`, `GO`, `THRU`, `ENTER`, `0-9`) |
| **Cue Pool** | Create/list/delete cues via REST API; each cue can carry an automated **effect** (chaser / rainbow / strobe) that plays back on GO |
| **Scene Pool** | Save/recall fader snapshots in `localStorage`; 3 demo scenes preload on first run |
| **Patch / Fixture Sheet** | Assign a name, fixture type (12 types incl. Moving Head, Wash, Mirror Ball, Fog, Blinder…) and DMX address per channel |
| **Design Creator** | Assign a color per channel and save the combined look (levels + colors) as a reusable Design |
| **Group Pool** | Group channels (e.g. `1,2,3`) and set their level together |
| **Automation** | Loops through stored scenes at a configurable interval; also drives the Catalyst preview in sync |
| **Effects** | Chaser / Rainbow / Strobe presets plus 8 quick color swatches |
| **Stage View** | Live canvas beam simulator with truss, stage floor, and **per-fixture-type rendering** (focused beams leave a gobo mark, washes flood the floor, mirror balls sparkle, fog hazes, strobes flash) |
| **Catalyst** | Green Hippo–style 4-layer media panel with opacity/blend modes and a real-time composited output preview |
| **Timecode** | Runs a clock and fires a pre-built scene/effect sequence at set marks |
| **Grand Master / Sub Master** | Two master faders that scale the entire Stage View output |
| **Pan/Tilt/Zoom/Color/Gobo encoders** | Draggable rotary controls (mouse + touch) wired live to the Stage View beams |
| **Export/Import** | Export/import scenes as `.json` files ([samples/default-scenes.json](samples/default-scenes.json) included) |
| **Hotkeys** | `B` Blackout · `F` Full · `S` focus Store Scene · `D` toggle theme · `1-8` focus a fader |
| **Tutorial Mode** | Guided tour that highlights each panel in sequence |
| **Setup Page** | Decorative Setup screen mirroring the real console's menu layout |

## Screens / Tabs

The console screen is organized into tabs, each a self-contained page:

`Pools` → `Patch` → `Executor` → `Stage View` → `Design` → `Catalyst` → `Setup`

A left icon rail (Setup, Help, Theme, quick jumps) and a right numbered rail (Fixture, Preset, Sequence Sheet, Tracking Sheet, Phaser+Steps, 3D, Timecode, Setup) mirror the navigation model of a real console.

## Documentation

| Doc | Contents |
|---|---|
| [docs/USAGE.md](docs/USAGE.md) | Full user guide — every panel, hotkey and workflow |
| [docs/API.md](docs/API.md) | REST endpoint reference (cue CRUD, health check) |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Architecture, data flow, serverless migration notes |
| [docs/AUTOMATION.md](docs/AUTOMATION.md) | Bridging cues/scenes to QLab / OSC-capable consoles |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Code structure, module conventions, extension points |

## Architecture

```
public/                     Frontend (vanilla JS, no bundler)
├── index.html               Console shell: screen tabs + physical deck
├── css/style.css             Green-terminal theme, console/deck skin
└── js/
    ├── app.js                 Core: faders, cues, scenes, patch, design,
    │                          command line, encoders, Stage View renderer
    └── module-*.js             Self-registering panels: advance, effects,
                               groups, automation, monitoring, export,
                               hotkeys, timecode, catalyst

server.js                    Express API: cue CRUD (in-memory), logging,
                              static file serving

samples/default-scenes.json  Ready-to-import demo scene pack
```

- **Server** owns cue data only (in-memory, resets on restart).
- **Client** owns fader/scene/patch/design state, persisted in `localStorage` — the server never sees it.
- Every `module-*.js` is an independent script that reads/writes the shared `window.GMA3` namespace and injects its own panel into the DOM.

See [docs/TECHNICAL.md](docs/TECHNICAL.md) for the full data-flow breakdown and notes on deploying the API as serverless functions.

## Stack

Vanilla JavaScript (ES6, no build step) · Semantic HTML5 · Plain CSS · Node.js + Express

No React, no Vue, no bundler — the entire frontend is loaded as classic `<script>` tags.

## Roadmap

- [ ] External remote-preview window (second screen, live-synced Stage View)
- [ ] OSC bridge to QLab / real consoles (see [docs/AUTOMATION.md](docs/AUTOMATION.md))
- [ ] Persistent cue storage (DB-backed) for serverless deployment

## License

Internal training project. No license file yet — treat as all-rights-reserved until one is added.
