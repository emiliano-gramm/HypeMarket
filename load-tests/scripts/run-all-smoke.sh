#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-all-smoke.sh — runs all three paths sequentially (smoke profile only)
#
# Usage: ./load-tests/scripts/run-all-smoke.sh
#
# How often: SAFE to run for a full pipeline check (~2–3 min total, all auto-stop).
#   Equivalent to: smoke poll-read + smoke poll-vote + mqtt soak (10 subs, 30s).
# Cost (one run): ~$0 — smallest end-to-end verification of steps 1–7.
#   Billing: Vercel → Usage | AWS → Cost Explorer (only if curious).
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS="$ROOT/load-tests/scripts"

echo "=== 1/3 Market read (k6) ==="
"$SCRIPTS/run-smoke.sh" poll-read

if [[ -f "$ROOT/load-tests/.env" ]] && grep -q "LOAD_TEST_SECRET=" "$ROOT/load-tests/.env" 2>/dev/null; then
  echo ""
  echo "=== 2/3 Stake writes (k6) ==="
  "$SCRIPTS/run-smoke.sh" poll-vote
else
  echo ""
  echo "=== 2/3 Stake writes — SKIPPED (set LOAD_TEST_SECRET in load-tests/.env) ==="
fi

echo ""
echo "=== 3/3 MQTT subscribers (Node) ==="
if [[ -f "$ROOT/load-tests/.env" ]]; then
  MQTT_CONNECTIONS=10 MQTT_DURATION_SEC=30 "$SCRIPTS/run-mqtt-soak.sh"
else
  echo "SKIPPED — copy load-tests/.env.example to load-tests/.env first"
fi

echo ""
echo "All load-test paths complete."
