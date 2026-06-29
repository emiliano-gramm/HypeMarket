#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-smoke.sh — quick local k6 smoke test (~30s–1m, auto-stops)
#
# Usage: ./load-tests/scripts/run-smoke.sh [poll-read|poll-vote|combined]
#
# How often: SAFE to run repeatedly while developing (poll-read anytime;
#   poll-vote/combined sparingly if you care about poll DB clutter).
# Auto-stop: YES — duration is fixed in load-tests/k6/lib/config.js (smoke profile).
# Cost (one run, all scenarios): ~$0 — local k6 is free; Vercel/DSQL traffic is tiny.
#   Billing: Vercel → Project → Usage | AWS → Billing → Cost Explorer (DSQL/Cognito).
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_TESTS="$ROOT/load-tests"
SCENARIO="${1:-combined}"

# shellcheck disable=SC1091
source "$LOAD_TESTS/scripts/lib/results.sh"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed. See https://grafana.com/docs/k6/latest/set-up/install-k6/"
  exit 1
fi

if [[ -f "$LOAD_TESTS/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LOAD_TESTS/.env"
  set +a
fi

export K6_PROFILE="${K6_PROFILE:-smoke}"
export BASE_URL="${BASE_URL:-https://hypemarket.vercel.app}"

case "$SCENARIO" in
  poll-read)
    SCRIPT="$LOAD_TESTS/k6/poll-read.js"
    ;;
  poll-vote)
    SCRIPT="$LOAD_TESTS/k6/poll-vote.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for poll-vote. Copy load-tests/.env.example to load-tests/.env"
      exit 1
    fi
    ;;
  combined)
    SCRIPT="$LOAD_TESTS/k6/combined.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for combined. Copy load-tests/.env.example to load-tests/.env"
      exit 1
    fi
    ;;
  *)
    echo "Unknown scenario: $SCENARIO (use poll-read, poll-vote, or combined)"
    exit 1
    ;;
esac

load_test_init_results "$LOAD_TESTS"
load_test_set_paths "smoke-${SCENARIO}"

echo "Running k6 smoke: $SCENARIO (profile=$K6_PROFILE, target=$BASE_URL)"
set -o pipefail
k6 run \
  --summary-export="$LOAD_TEST_JSON" \
  "$SCRIPT" 2>&1 | tee "$LOAD_TEST_LOG"

echo "Summary exported to $LOAD_TEST_JSON"
echo "Full log saved to $LOAD_TEST_LOG"
