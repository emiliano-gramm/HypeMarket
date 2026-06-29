#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-k6-cloud.sh — DISTRIBUTED global load test via Grafana k6 Cloud (~9 min)
#
# Usage: ./load-tests/scripts/run-k6-cloud.sh [poll-read|poll-vote|combined]
# Requires: k6 cloud login
#
# ⚠️  WARNING — DO NOT run willy-nilly. Cloud profile ramps to thousands–10k VUs
#   across US/EU/AP. This burns k6 Cloud VUh (virtual-user-hours) fast and can hit
#   paid tiers quickly after the free allowance. Run ONCE for hackathon proof, then stop.
# How often: ONCE (or twice max) for documentation screenshots — not for debugging.
# Auto-stop: YES — ~9 min (cloud profile in k6/lib/config.js).
# Cost (one combined run): k6 Cloud VUh (check free tier) + heavy Vercel/DSQL/Lambda.
#   Expect the largest bill of all scripts if free tiers are exceeded.
#   Billing: Grafana Cloud → k6 → Usage | Vercel → Usage | AWS → Cost Explorer.
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_TESTS="$ROOT/load-tests"
SCENARIO="${1:-combined}"

# shellcheck disable=SC1091
source "$LOAD_TESTS/scripts/lib/results.sh"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed."
  exit 1
fi

if [[ -f "$LOAD_TESTS/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LOAD_TESTS/.env"
  set +a
fi

export K6_PROFILE=cloud
export BASE_URL="${BASE_URL:-https://hypemarket-v0-aws.vercel.app}"

case "$SCENARIO" in
  poll-read) SCRIPT="$LOAD_TESTS/k6/poll-read.js" ;;
  poll-vote)
    SCRIPT="$LOAD_TESTS/k6/poll-vote.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for poll-vote cloud runs."
      exit 1
    fi
    ;;
  combined)
    SCRIPT="$LOAD_TESTS/k6/combined.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for combined cloud runs."
      exit 1
    fi
    ;;
  *)
    echo "Unknown scenario: $SCENARIO"
    exit 1
    ;;
esac

load_test_init_results "$LOAD_TESTS"
load_test_set_paths "cloud-${SCENARIO}"

echo "Launching k6 Cloud run: $SCENARIO"
echo "Geographic zones: us-east (Ashburn), eu-west (Dublin), ap-southeast (Singapore — amazon:sg:singapore)"
echo "Target: $BASE_URL"
echo "Local summary will be saved to $LOAD_TEST_JSON"

CLOUD_ARGS=()
if [[ -n "${K6_CLOUD_PROJECT_ID:-}" ]]; then
  CLOUD_ARGS+=(--project-id "$K6_CLOUD_PROJECT_ID")
fi

# Pass secrets to k6 Cloud (encrypted in transit; not stored in script files)
set -o pipefail
k6 cloud run \
  "${CLOUD_ARGS[@]}" \
  --summary-export="$LOAD_TEST_JSON" \
  -e "BASE_URL=${BASE_URL}" \
  -e "LOAD_TEST_SECRET=${LOAD_TEST_SECRET:-}" \
  -e "K6_PROFILE=cloud" \
  -e "K6_CLOUD_PROJECT_ID=${K6_CLOUD_PROJECT_ID:-}" \
  "$SCRIPT" 2>&1 | tee "$LOAD_TEST_LOG"

echo "Summary exported to $LOAD_TEST_JSON"
echo "Full log saved to $LOAD_TEST_LOG"
echo "Grafana Cloud UI also has the full run dashboard."
