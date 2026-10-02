#!/usr/bin/env bash
# Start a private Next dev server for one agent and wait until it answers.
# Usage: scripts/dev-server.sh <name> <port>      (stop with: scripts/dev-server.sh stop <port>)
# Logs: /tmp/claude-0/-home-user-Real-estate-karthiks/6fff8b1b-9614-559a-8719-d09defb144d9/scratchpad/dev-<name>.log
set -euo pipefail
cd "$(dirname "$0")/.."
LOGDIR=/tmp/claude-0/-home-user-Real-estate-karthiks/6fff8b1b-9614-559a-8719-d09defb144d9/scratchpad
if [ "${1:-}" = "stop" ]; then
  pids=$(lsof -ti:"$2" 2>/dev/null || true); [ -n "$pids" ] && kill $pids || true; echo "stopped :$2"; exit 0
fi
NAME=$1; PORT=$2
service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null
if curl -s -o /dev/null "http://localhost:$PORT/login"; then echo "already running on :$PORT"; exit 0; fi
NEXT_DIST_DIR=".next-$NAME" nohup npx next dev -p "$PORT" > "$LOGDIR/dev-$NAME.log" 2>&1 &
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/settings" || true)
  [ "$code" = "401" ] && { echo "ready on http://localhost:$PORT (log $LOGDIR/dev-$NAME.log)"; exit 0; }
  sleep 1
done
echo "dev server did not become ready; see $LOGDIR/dev-$NAME.log"; exit 1
