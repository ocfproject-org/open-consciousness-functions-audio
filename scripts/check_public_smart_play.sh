#!/usr/bin/env bash
set -euo pipefail
if [[ ! -f smart-play/public-release.json ]]; then exit 0; fi
site=${1:-verified-site}
log=$(mktemp)
python -m http.server 41981 --bind 127.0.0.1 --directory "$site" > "$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -f "$log"' EXIT
for i in {1..50}; do
  if curl -fsS -o /dev/null http://127.0.0.1:41981/; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$log"; exit 1; fi
  sleep 0.2
done
node scripts/check_public_smart_play.cjs http://127.0.0.1:41981
