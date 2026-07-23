# GrandMA3 Training System

A vanilla HTML5/CSS3/JavaScript training console inspired by the grandMA3 lighting desk. Zero frontend dependencies, Express backend for cue storage, green-terminal theme.

## Setup

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Features

- **Fader Sheet** - 8 channel faders, drag or click to set intensity (0-100%), mouse + touch.
- **Command line** - type `FULL`, `OFF` / `BLACKOUT`, `AT <0-100>`, `CLEAR`.
- **Cue Pool** - create/list/delete cues via REST API (server-side, in-memory).
- **Scene Pool** - save/recall fader snapshots in `localStorage`, persistent across reloads. 3 demo scenes are preloaded on first run.
- **Group Pool** - group channels (e.g. `1,2,3`) and set their level together.
- **Automation** - loops through stored scenes automatically at a configurable interval (try it with the 3 preloaded demo scenes: 5s cycle).
- **Effects** - chaser that steps 100% across one channel at a time.
- **Advanced** - quick Blackout / Full / Freeze.
- **DMX Monitor** - live view of DMX values (0-255) per channel, refreshed every 500ms.
- **Export/Import** - export/import scenes as `.json` files.
- **Hotkeys** - keyboard shortcuts, see table below.
- **Tutorial mode** - guided tour highlighting each panel (button top-right).
- **Theme toggle** - dark (green on black, default) / light.

## Hotkeys

| Key | Action |
|---|---|
| B | Blackout |
| F | Full (all channels to 100%) |
| S | Focus the "Store Scene" field |
| D | Toggle light/dark theme |
| 1-8 | Focus the fader for the matching channel |

Disabled while typing in a text field.

## Documentation

- [docs/API.md](docs/API.md) - REST endpoint reference
- [docs/USAGE.md](docs/USAGE.md) - full user guide
- [docs/TECHNICAL.md](docs/TECHNICAL.md) - architecture, data flow, serverless notes
- [docs/AUTOMATION.md](docs/AUTOMATION.md) - connecting to QLab / QL5
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - code structure, extension points

## Test checklist

- [ ] Fader drag and click work (mouse + touch)
- [ ] Scene save/recall persists after page reload
- [ ] Cue create/list/delete round-trips through the API
- [ ] Export downloads a `.json`, Import restores scenes
- [ ] Automation cycles the 3 demo scenes every 5s
- [ ] DMX Monitor updates live as faders move
- [ ] Command line: `AT 50`, `FULL`, `OFF`, `CLEAR` all work
- [ ] Hotkeys: `B`, `F`, `S`, `D`, `1`-`8`
- [ ] Scenes/theme persist in `localStorage` after refresh
- [ ] Zero errors in the browser console

## Stack

Vanilla JS (ES6, no build step), semantic HTML5, plain CSS, Node.js + Express backend. See [docs/TECHNICAL.md](docs/TECHNICAL.md) for details.
