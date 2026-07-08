# Image unique : backend + frontend + proxy interne, un seul port exposé.

# ---------- Backend build ----------
FROM node:24-bookworm-slim AS backend-build
WORKDIR /app/backend

# sharp requires build deps for native bindings on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma
RUN pnpm install --prod=false

COPY apps/backend/tsconfig.json ./
COPY apps/backend/src ./src
RUN pnpm run db:generate && pnpm run build && pnpm prune --prod

# ---------- Frontend build ----------
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY apps/frontend/package.json ./
RUN pnpm install --prod=false

COPY apps/frontend/. .

# Le frontend est servi derrière le même proxy que le backend (même origine) :
# les appels API restent toujours relatifs, pas besoin d'URL backend distincte.
ENV NEXT_PUBLIC_API_URL=
RUN pnpm run build
# vinext (CLI utilisée par `pnpm run start`) est une devDependency : pas de
# `pnpm prune --prod` ici, contrairement au backend.

# ---------- Runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY --from=backend-build /app/backend ./backend
COPY --from=frontend-build /app/frontend ./frontend

COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/proxy.mjs ./proxy.mjs
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/backend/uploads /app/backend/db

# Port public unique. BACKEND_PORT/FRONTEND_PORT sont des ports internes au
# conteneur (proxy <-> process), à ne pas exposer/mapper depuis l'hôte.
ENV PORT=3000
ENV BACKEND_PORT=3001
ENV FRONTEND_PORT=3002

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
