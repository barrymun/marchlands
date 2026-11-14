# Build the client with the shared workspace packages, then serve the static files with nginx.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/core/package.json shared/core/
COPY shared/contracts/package.json shared/contracts/
COPY shared/api-client/package.json shared/api-client/
COPY backend/packages/db/package.json backend/packages/db/
COPY backend/packages/game/package.json backend/packages/game/
COPY backend/services/api/package.json backend/services/api/
COPY backend/services/worker/package.json backend/services/worker/
COPY client/web/package.json client/web/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY shared shared
# the contract's row schemas are derived from the Drizzle tables (type-checked by the client build)
COPY backend/packages/db backend/packages/db
COPY client/web client/web
COPY tools/build/precompress.mjs tools/build/precompress.mjs
RUN npm run build -w @marchlands/web && node tools/build/precompress.mjs client/web/dist

FROM nginx:1.29-alpine
# a template: the image's entrypoint writes it to conf.d/default.conf with these settings filled in (envsubst, which
# only touches the environment's own variables, so nginx's $host and the like stay)
ENV TRUSTED_PROXY=127.0.0.1
ENV AUTH_RATE=1r/s
ENV AUTH_BURST=20
COPY client/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/web/dist /usr/share/nginx/html
