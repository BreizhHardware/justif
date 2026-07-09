# Single image: backend + frontend + internal proxy, one exposed port.

# ---------- Backend build ----------
FROM node:24-bookworm-slim AS backend-build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/prisma ./apps/backend/prisma/

RUN pnpm install --filter backend --frozen-lockfile --prod=false

COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/prisma.config.ts ./apps/backend/
COPY apps/backend/src ./apps/backend/src/

ENV DATABASE_URL=file:./db/justif.db
RUN pnpm --filter backend run db:generate && pnpm --filter backend run build

# pnpm deploy creates a self-contained directory: flat node_modules, no symlinks.
# The "files" field in package.json includes dist/ and prisma/ despite .gitignore.
RUN pnpm deploy --filter backend --prod --legacy /deploy/backend

# ---------- Frontend build ----------
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --filter frontend --frozen-lockfile --prod=false

COPY apps/frontend/. ./apps/frontend/

ENV NEXT_PUBLIC_API_URL=
RUN pnpm --filter frontend run build

# Without --prod: vinext is a devDependency required at runtime for `vinext start`.
RUN pnpm deploy --filter frontend --legacy /deploy/frontend

# ---------- Runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

COPY --from=backend-build /deploy/backend ./backend
COPY --from=frontend-build /deploy/frontend ./frontend

COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/proxy.mjs ./proxy.mjs
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/backend/uploads /app/backend/db

# Single public port. BACKEND_PORT/FRONTEND_PORT are internal ports.
ENV PORT=3000
ENV BACKEND_PORT=3001
ENV FRONTEND_PORT=3002

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
