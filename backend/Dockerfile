# Single image for every backend service (api, worker, migrate). The build stage bundles each entry point with
# esbuild (tools/build/backend.mjs); the runtime image holds only Node, the bundles, their source maps and the files
# they read: no TypeScript sources, no node_modules, no npm.

FROM node:24-alpine AS build
WORKDIR /app

# dependency layer: only manifests, so source edits don't bust the npm cache
# (every workspace manifest is copied so the lockfile resolves; only the backend's deps and the root's build tools are installed)
COPY package.json package-lock.json ./
COPY shared/core/package.json shared/core/
COPY shared/contracts/package.json shared/contracts/
COPY shared/api-client/package.json shared/api-client/
COPY backend/packages/db/package.json backend/packages/db/
COPY backend/packages/game/package.json backend/packages/game/
COPY backend/services/api/package.json backend/services/api/
COPY backend/services/worker/package.json backend/services/worker/
COPY client/web/package.json client/web/
RUN npm ci --ignore-scripts --include-workspace-root -w @marchlands/api -w @marchlands/worker && npm cache clean --force

COPY tsconfig.base.json ./
COPY shared/core/src shared/core/src
COPY shared/contracts/src shared/contracts/src
COPY backend/packages/db/src backend/packages/db/src
COPY backend/packages/db/migrations backend/packages/db/migrations
COPY backend/packages/game/src backend/packages/game/src
COPY backend/services/api/src backend/services/api/src
COPY backend/services/worker/src backend/services/worker/src
COPY tools/build tools/build
RUN node tools/build/backend.mjs --minify

# the services only run node: plain Alpine (node:24-alpine's base) with the node binary and the C++ runtime it
# links, without npm, npx, yarn and corepack
FROM alpine:3.24
RUN apk add --no-cache libstdc++ && adduser -D -u 1000 node
COPY --from=build /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
ENV NODE_ENV=production
ENV WORLD_MAP_FILE=/app/db/seed/legacy-map-800.bin.gz
COPY --from=build /app/dist/backend dist/backend
# source maps, never loaded at run time; read by the trace tool to decode stack traces (docs/deployment.md)
COPY --from=build /app/dist/backend-maps dist/backend-maps
COPY tools/build/trace.mjs tools/build/trace.mjs
COPY db/seed db/seed

USER node
CMD ["node", "dist/backend/bin/api.mjs"]
