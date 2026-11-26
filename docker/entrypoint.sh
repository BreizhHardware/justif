#!/bin/bash
set -e

PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3002}"

cd /app/backend
# Call the binaries directly: pnpm 12 would try to resolve/write a lockfile at startup,
# which fails for the non-root user (read-only app dirs).
./node_modules/.bin/prisma migrate deploy
# Loopback only: the backend must be reached through the internal proxy (trusted X-Forwarded-For).
BACKEND_HOST=127.0.0.1 PORT="$BACKEND_PORT" node dist/index.js &
BACKEND_PID=$!

cd /app/frontend
PORT="$FRONTEND_PORT" ./node_modules/.bin/vinext start &
FRONTEND_PID=$!

cd /app
PORT="$PORT" BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" node proxy.mjs &
PROXY_PID=$!

cleanup() {
  kill -TERM "$BACKEND_PID" "$FRONTEND_PID" "$PROXY_PID" 2>/dev/null
}
trap cleanup TERM INT

wait -n "$BACKEND_PID" "$FRONTEND_PID" "$PROXY_PID"
EXIT_CODE=$?
cleanup
exit "$EXIT_CODE"
