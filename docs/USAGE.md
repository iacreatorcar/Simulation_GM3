# User Guide - Simulation GM3 Training System

## Start

```bash
npm install
npm start
```

Open your browser at `http://localhost:3000`.

## Interface

The screen is laid out as a set of pool windows, similar to a professional moving-light console, with a command line and playback strip at the bottom.

### Fader Sheet
8 vertical faders (channels 1-8). Two ways to control them:
- **Click the track**: jumps straight to that value
- **Drag the handle**: drag the green handle for precise control (works past the track edges too, and on touch screens)

### Cue Pool
Form to store a cue (name + fade time). Cues are saved on the server (in memory, lost on restart) through the REST API. Delete them with the X button.

### Scene Pool
Saves the current fader state as a "scene" in the browser (`localStorage`), persistent across sessions. Use GO to recall it, X to delete it.

### Command line

At the bottom of the console, type commands and press Enter or click Execute:

| Command | Action |
|---|---|
| `FULL` | All channels to 100% |
| `OFF` / `BLACKOUT` | All channels to 0% |
| `AT <value>` | Sets channels to `<value>` (0-100) |
| `CLEAR` | Clears the current selection |

### Additional modules (executor pool)

| Module | Function |
|---|---|
| Advanced | Quick Blackout, Full, Freeze |
| Effects | Automatic chaser stepping across channels |
| Group Pool | Group channels (e.g. "1,2,3") and control them together |
| Automation | Loops through stored scenes at a configurable interval |
| DMX Monitor | Live view of DMX values (0-255) |
| Export/Import | Export/import scenes as `.json` files |
| Hotkeys | Keyboard shortcuts (see below) |

## Keyboard shortcuts

| Key | Action |
|---|---|
| B | Blackout |
| F | Full (all channels to 100%) |
| S | Focus the "Store Scene" field |
| D | Toggle light/dark theme |
| 1-8 | Focus the fader for the matching channel |

Hotkeys are disabled while typing in a text field.

## Theme

The "Display" button in the top-right toggles dark theme (green on black, default) and light theme. The preference is saved in `localStorage`.

## Debug

Open the browser console (F12) to see detailed logs of every action (faders, API calls, scenes, modules).
