FROM node:24-bookworm-slim AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false

COPY . .
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "run", "start"]
