# Build the SPA, then serve the static files with nginx.
FROM node:22-bookworm AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml biome.json ./
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile=false
COPY packages/web ./packages/web
# Baked into the bundle: the API URL the BROWSER uses (host-reachable).
ARG VITE_API_BASE_URL=http://localhost:8080/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
