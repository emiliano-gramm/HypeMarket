#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-sustained.sh — local k6 at the honest sustained operating point (~45/s)
#
# Usage: ./load-tests/scripts/run-sustained.sh [poll-read|poll-vote|combined]
#
# Same cloud-geo profile as run-k6-cloud-geo.sh, but runs locally (k6 run).
# Default scenario: poll-vote — 45 stakes/sec for 5 minutes.
#
# How often: RUN SPARINGLY — before demos/docs or when re-validating scale numbers.
# Requires LOAD_TEST_SECRET in load-tests/.env + on Vercel.
# After the run: ./infrastructure/dsql/reset-demo-market.sh
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_TESTS="$ROOT/load-tests"
SCENARIO="${1:-poll-vote}"

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

export K6_PROFILE=cloud-geo
export BASE_URL="${BASE_URL:-https://hypemarket.vercel.app}"
export GEO_STAKE_RATE="${GEO_STAKE_RATE:-45}"
export GEO_DURATION="${GEO_DURATION:-5m}"
export GEO_READER_VUS="${GEO_READER_VUS:-25}"
export GEO_VU_BUDGET="${GEO_VU_BUDGET:-100}"
export GEO_STAKE_MAX_VUS="${GEO_STAKE_MAX_VUS:-$((GEO_VU_BUDGET - GEO_READER_VUS))}"

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
    echo "Usage: $0 [poll-read|poll-vote|combined]"
    exit 1
    ;;
esac

load_test_init_results "$LOAD_TESTS"
load_test_set_paths "sustained-${SCENARIO}"

echo "Running k6 sustained (local): $SCENARIO"
echo "Profile: cloud-geo (${GEO_STAKE_RATE}/s stakes, ${GEO_READER_VUS} readers, ${GEO_DURATION})"
echo "Target: $BASE_URL"
echo "Tip: run telemetry_mock_data/producer.js in another terminal for live MQTT traffic."
echo ""
echo "After the run, reset demo market data:"
echo "  ./infrastructure/dsql/reset-demo-market.sh"

set -o pipefail
k6 run \
  --summary-export="$LOAD_TEST_JSON" \
  -e "BASE_URL=${BASE_URL}" \
  -e "LOAD_TEST_SECRET=${LOAD_TEST_SECRET:-}" \
  -e "K6_PROFILE=cloud-geo" \
  -e "GEO_STAKE_RATE=${GEO_STAKE_RATE}" \
  -e "GEO_DURATION=${GEO_DURATION}" \
  -e "GEO_READER_VUS=${GEO_READER_VUS}" \
  -e "GEO_VU_BUDGET=${GEO_VU_BUDGET}" \
  -e "GEO_STAKE_MAX_VUS=${GEO_STAKE_MAX_VUS}" \
  "$SCRIPT" 2>&1 | tee "$LOAD_TEST_LOG"

echo ""
echo "Summary exported to $LOAD_TEST_JSON"
echo "Full log saved to $LOAD_TEST_LOG"
echo "Run ./infrastructure/dsql/reset-demo-market.sh before your next demo."
