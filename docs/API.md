# API Reference - GrandMA3 Training System

Base URL: `http://localhost:3000`

All responses are JSON and include a `success` field (boolean).

## GET /api/health

Server health check.

**Response 200:**
```json
{ "success": true, "status": "ok", "uptime": 12.34 }
```

## POST /api/cue/create

Creates a new cue.

**Body:**
```json
{
  "name": "Opening Cue",
  "fadeTime": 3,
  "faders": [50, 100, 0, 0, 0, 0, 0, 0],
  "effect": "chaser"
}
```

- `name` (string, required)
- `fadeTime` (number, optional, default 3)
- `faders` (array, optional)
- `effect` (string, optional, one of `none`/`chaser`/`rainbow`/`strobe`, default `none`) - automatically played back on the Stage View when the cue is recalled

**Response 201:**
```json
{ "success": true, "cue": { "id": 1, "name": "Opening Cue", "faders": [...], "fadeTime": 3, "effect": "chaser", "createdAt": "..." } }
```

**Response 400** (validation failed):
```json
{ "success": false, "errors": ["Field \"name\" is required (non-empty string)"] }
```

## GET /api/cue/list

Lists all created cues.

**Response 200:**
```json
{ "success": true, "count": 2, "cues": [ { "id": 1, "name": "..." }, ... ] }
```

## GET /api/cue/:id

Returns a single cue.

**Response 200:** `{ "success": true, "cue": {...} }`
**Response 404:** `{ "success": false, "error": "Cue 99 not found" }`

## DELETE /api/cue/:id

Deletes a cue by id.

**Response 200:**
```json
{ "success": true, "removed": { "id": 1, "name": "Opening Cue" } }
```

**Response 404:** `{ "success": false, "error": "Cue 99 not found" }`

## Generic errors

- **404** on unknown routes: `{ "success": false, "error": "Route not found: /xxx" }`
- **500** on internal errors: `{ "success": false, "error": "Internal server error" }`

Note: cues live in memory (lost on server restart). Scenes are instead stored client-side in `localStorage` and never touch the server.
