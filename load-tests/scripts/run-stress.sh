#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-stress.sh — heavier local k6 test (~5 min, auto-stops)
#
# Usage: ./load-tests/scripts/run-stress.sh [poll-read|poll-vote|combined]
#
# How often: RUN SPARINGLY — once to validate, then only before demos/docs.
#   Not for every commit. Ramps to hundreds of VUs / hundreds of votes per minute.
# Auto-stop: YES — ~5 min total (see stress profile in k6/lib/config.js).
# Cost (one combined run): usually $0 on free tiers, but non-trivial AWS/Vercel usage
#   (thousands of requests, many DSQL writes if voting). Check dashboards after.
#   Billing: Vercel → Usage | AWS → Cost Explorer (DSQL, Lambda, Cognito).
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_TESTS="$ROOT/load-tests"
SCENARIO="${1:-combined}"

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

export K6_PROFILE=stress
export BASE_URL="${BASE_URL:-https://ultimate-global-entertainment.vercel.app}"

mkdir -p "$LOAD_TESTS/results"

case "$SCENARIO" in
  poll-read) SCRIPT="$LOAD_TESTS/k6/poll-read.js" ;;
  poll-vote)
    SCRIPT="$LOAD_TESTS/k6/poll-vote.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required. See load-tests/.env.example"
      exit 1
    fi
    ;;
  combined)
    SCRIPT="$LOAD_TESTS/k6/combined.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required. See load-tests/.env.example"
      exit 1
    fi
    ;;
  *)
    echo "Unknown scenario: $SCENARIO"
    exit 1
    ;;
esac

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$LOAD_TESTS/results/stress-${SCENARIO}-${STAMP}.json"

echo "Running k6 stress: $SCENARIO (target=$BASE_URL)"
echo "Tip: run telemetry_mock_data/producer.js in another terminal for live MQTT traffic."

k6 run \
  --summary-export="$OUT" \
  "$SCRIPT"

echo "Summary exported to $OUT"
