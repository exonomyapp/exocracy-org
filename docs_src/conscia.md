# Conscia Node Connectivity UI

The **/conscia/** page on exocracy.org is a lightweight observer and engagement UI for remote Conscia nodes.

## Multi-node observation

The UI supports saving multiple node endpoints (e.g. reserved zrok URLs) and polling:

- `/api/stats`
- `/api/peers`

## Phase 4 endpoints (ExoSystems Walkthrough 69)

The Conscia HTTP gateway exposes:

- `GET /api/discovery`
- `GET /api/capabilities` (includes `sdui_widgets`)
- `POST /api/capabilities/petition`
- `POST /api/capabilities/verify`
- `GET /api/index/search`

## Authentication header (proto)

The UI currently attaches identity as an `Authorization` scheme header:

```
Authorization: ExoAuth did="did:peer:…", ts="…"
```

This is “signature-ready”: we will later add a signature field once the server-side verification contract is finalized.

