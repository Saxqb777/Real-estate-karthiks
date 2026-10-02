#!/usr/bin/env bash
# Start a private Next dev server for one agent and wait until it answers.
# Usage: scripts/dev-server.sh <name> <port> [db]   db = estates_dev (default) | estates_demo (sample data)
#        stop with: scripts/dev-server.sh stop <port>
# Logs: /tmp/claude-0/-home-user-Real-estate-karthiks/6fff8b1b-9614-559a-8719-d09defb144d9/scratchpad/dev-<name>.log
set -euo pipefail
cd "$(dirname "$0")/.."
LOGDIR=/tmp/claude-0/-home-user-Real-estate-karthiks/6fff8b1b-9614-559a-8719-d09defb144d9/scratchpad
if [ "${1:-}" = "stop" ]; then
  # Kill the whole `next dev` tree (the parent respawns its worker if only the listener dies).
  pids=$(ps -eo pid,args | awk -v p="next dev -p $2" 'index($0, p) && !/awk/ && !/dev-server.sh/ {print $1}')
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
  sleep 1
  left=$(lsof -ti:"$2" 2>/dev/null || true); [ -n "$left" ] && kill -9 $left 2>/dev/null || true
  echo "stopped :$2"; exit 0
fi
NAME=$1; PORT=$2; DB=${3:-estates_dev}
export DATABASE_URL="postgresql://estates:estates@localhost:5432/$DB" DIRECT_URL="postgresql://estates:estates@localhost:5432/$DB"
service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null
if curl -s -o /dev/null "http://localhost:$PORT/login"; then echo "already running on :$PORT"; exit 0; fi
NEXT_DIST_DIR=".next-$NAME" nohup npx next dev -p "$PORT" > "$LOGDIR/dev-$NAME.log" 2>&1 &
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/settings" || true)
  [ "$code" = "401" ] && { echo "ready on http://localhost:$PORT (log $LOGDIR/dev-$NAME.log)"; exit 0; }
  sleep 1
done
echo "dev server did not become ready; see $LOGDIR/dev-$NAME.log"; exit 1
