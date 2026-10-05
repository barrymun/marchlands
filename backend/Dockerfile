# Single image for every backend service (api, worker, migrate). Node 24 runs the TypeScript
# sources directly via native type stripping, so there is no build step.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# dependency layer: only manifests, so source edits don't bust the npm cache
# (every workspace manifest is copied so the lockfile resolves; only the backend's deps are installed)
COPY package.json package-lock.json ./
COPY shared/core/package.json shared/core/
COPY shared/contracts/package.json shared/contracts/
COPY shared/api-client/package.json shared/api-client/
COPY backend/packages/db/package.json backend/packages/db/
COPY backend/packages/game/package.json backend/packages/game/
COPY backend/services/api/package.json backend/services/api/
COPY backend/services/worker/package.json backend/services/worker/
COPY client/web/package.json client/web/
RUN npm ci --omit=dev --ignore-scripts -w @evony/api -w @evony/worker && npm cache clean --force

COPY tsconfig.base.json ./
COPY shared/core shared/core
COPY shared/contracts shared/contracts
COPY backend/packages backend/packages
COPY backend/services backend/services
COPY db/seed db/seed

USER node
CMD ["node", "backend/services/api/src/main.ts"]
