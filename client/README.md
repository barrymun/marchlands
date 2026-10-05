# client

Placeholder for the game client. Everything it needs is served by the backend:

- REST API — `docs/api-endpoints.md`, interactive at `/docs` (OpenAPI JSON at `/docs/json`,
  usable for generating a typed client)
- live updates — WebSocket `/ws?token=...`, see `docs/websocket.md`
- static game data (buildings, research, troops, items, titles, balance) — `GET /api/v1/config/static`
