#!/bin/bash
set -e

PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3002}"

cd /app/backend
pnpm run db:deploy
PORT="$BACKEND_PORT" node dist/index.js &
BACKEND_PID=$!

cd /app/frontend
PORT="$FRONTEND_PORT" pnpm run start &
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
