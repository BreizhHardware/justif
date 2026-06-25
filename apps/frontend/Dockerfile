FROM node:24-bookworm-slim AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false

COPY . .

ENV NEXT_PUBLIC_API_URL=__RUNTIME_NEXT_PUBLIC_API_URL__
RUN pnpm run build
ENV NEXT_PUBLIC_API_URL=

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "run", "start"]
