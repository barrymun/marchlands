# client

## web

`client/web` is a browser client: Vite, React 19, Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) (Radix, "nova" preset), TanStack Query and React Router.

```bash
npm run dev:web     # http://localhost:5173, proxies /api, /ws and /docs to the API (API_PORT from ../.env)
npm run build:web   # type-check + production build into client/web/dist
```

In Docker the `web` service serves the build with nginx on `WEB_PORT` and proxies the API, so the browser only ever talks to one origin.

What it covers so far: register / log in, founding a city, the city view (inside slots, fields, build / upgrade / demolish / cancel / free speed-up with live timers), live resources, troop training and fortifications, heroes and the Inn, research, armies (with recall), and a 15×15 map with tile info and sending armies (attack, scout, reinforce, transport, found a city).

### How it is typed

Nothing is hand-typed against the API:

- `@marchlands/api-client` (`shared/api-client`) exposes `createApiClient` (openapi-fetch over the generated `paths`), `unwrap` for the `{ ok, data }` envelope (throws `ApiError` with the game's error code), and `PushClient` for the WebSocket with typed `on('server.X', data => ...)` handlers.
- Component types (`CityBean`, `HeroBean`, `MapCastle`, …) are exported by name from `@marchlands/api-client`.
- `@marchlands/core` is shared too: building/troop/tech names, enums, balance values and formulas (e.g. `scaled()` for game-speed-aware countdowns).

After a contract change run `npm run gen:api`; `npm run typecheck` then shows every call site that broke.

`src/hooks/use-game.ts` wires pushes into the TanStack Query cache (resource, troop and city updates patch the cache; other pushes invalidate the affected queries).

`src/components/ui/*` are shadcn components; add more with `npx shadcn@latest add <name>` from `client/web`.
