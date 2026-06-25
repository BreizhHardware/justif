#!/bin/sh
set -e

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}" node ./inject-runtime-env.mjs

exec "$@"
