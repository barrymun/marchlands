# Single image for every backend service (api, worker, migrate). Node 24 runs the TypeScript
# sources directly via native type stripping, so there is no build step.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# dependency layer: only manifests, so source edits don't bust the npm cache
COPY package.json package-lock.json ./
COPY backend/packages/core/package.json backend/packages/core/
COPY backend/packages/db/package.json backend/packages/db/
COPY backend/packages/game/package.json backend/packages/game/
COPY backend/services/api/package.json backend/services/api/
COPY backend/services/worker/package.json backend/services/worker/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY tsconfig.base.json ./
COPY backend/packages backend/packages
COPY backend/services backend/services
COPY db/seed db/seed

USER node
CMD ["node", "backend/services/api/src/main.ts"]
