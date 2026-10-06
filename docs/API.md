# API Reference - Simulation GM3 Training System

Base URL: `http://localhost:3000`

All responses are JSON and include a `success` field (boolean).

> **Note:** Cue persistence now runs through **Supabase** directly from the browser (see [Supabase integration](#supabase-integration) below). The `/api/cue/*` routes documented here still exist in `server.js` as an in-memory fallback used automatically when Supabase isn't configured (`.env` missing), but the frontend prefers Supabase whenever it's available.

## GET /api/health

Server health check.

**Response 200:**
```json
{ "success": true, "status": "ok", "uptime": 12.34 }
```

## GET /api/config

Returns the public Supabase configuration read from `.env`, so the frontend can initialize the Supabase client without hardcoding credentials.

**Response 200:**
```json
{ "success": true, "supabaseUrl": "https://xxxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
```

If `.env` is missing, both fields are `null` and the frontend falls back to the in-memory `/api/cue/*` routes.

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

Note: the in-memory fallback cues (above) are lost on server restart. Scenes/patch/design are always stored client-side in `localStorage` and never touch the server or Supabase.

## Supabase integration

When `.env` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` set, `app.js` talks to Supabase **directly from the browser** (via the `@supabase/supabase-js` CDN client) instead of the Express `/api/cue/*` routes:

| Operation | Supabase call |
|---|---|
| Create cue | `supabase.from('cues').insert([{ name, fade_time, effect, faders }])` |
| List cues | `supabase.from('cues').select('*').order('id')` |
| Delete cue | `supabase.from('cues').delete().eq('id', id)` |

A Realtime subscription on the `cues` table (`postgres_changes`, event `*`) means any browser tab/session sees cues created or deleted by another session **immediately**, without a manual refresh — this is what makes the demo "real time".

Table schema: see [supabase/schema.sql](../supabase/schema.sql). Row Level Security is enabled with public read/insert/delete policies — fine for a demo, **not** appropriate for real multi-tenant data (see [TECHNICAL.md](TECHNICAL.md#serverless-considerations)).
