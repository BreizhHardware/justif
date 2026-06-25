FROM node:24-bookworm-slim AS base
WORKDIR /app

# sharp requires build deps for native bindings on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN pnpm install --prod=false

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run db:generate && pnpm run build && pnpm prune --prod

RUN mkdir -p /app/uploads /app/db

EXPOSE 3001
CMD ["sh", "-c", "pnpm run db:deploy && node dist/index.js"]
