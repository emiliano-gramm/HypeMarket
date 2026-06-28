#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-k6-cloud-geo.sh — k6 Cloud at the honest sustained operating point (~45/s)
#
# Usage: ./load-tests/scripts/run-k6-cloud-geo.sh [poll-read|poll-vote|combined]
# Requires: k6 cloud login, LOAD_TEST_SECRET on Vercel + in load-tests/.env
#
# Distributes load at the sustained operating point (see explanation.md §5.20).
# Free Forever: 1 load zone per run (default US Ashburn). Set GEO_MULTI_ZONE=true
# for 3 zones in one run (paid plans), or use run-k6-cloud-geo-all-zones.sh.
#
# Default scenario: combined (~45 market readers + 45 stakes/sec for 5 minutes).
# After the run: ./infrastructure/dsql/reset-demo-market.sh
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

export K6_PROFILE=cloud-geo
export BASE_URL="${BASE_URL:-https://ultimate-global-entertainment.vercel.app}"
export GEO_STAKE_RATE="${GEO_STAKE_RATE:-45}"
export GEO_DURATION="${GEO_DURATION:-5m}"
export GEO_READER_VUS="${GEO_READER_VUS:-25}"
export GEO_VU_BUDGET="${GEO_VU_BUDGET:-100}"
export GEO_STAKE_MAX_VUS="${GEO_STAKE_MAX_VUS:-$((GEO_VU_BUDGET - GEO_READER_VUS))}"
# Free Forever = 1 zone/run. GEO_MULTI_ZONE=true for paid 3-zone single run.
export GEO_MULTI_ZONE="${GEO_MULTI_ZONE:-}"
export GEO_LOAD_ZONE="${GEO_LOAD_ZONE:-}"
export GEO_DEFAULT_ZONE="${GEO_DEFAULT_ZONE:-amazon:us:ashburn}"

case "$SCENARIO" in
  poll-read) SCRIPT="$LOAD_TESTS/k6/poll-read.js" ;;
  poll-vote)
    SCRIPT="$LOAD_TESTS/k6/poll-vote.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for poll-vote cloud-geo runs."
      exit 1
    fi
    ;;
  combined)
    SCRIPT="$LOAD_TESTS/k6/combined.js"
    if [[ -z "${LOAD_TEST_SECRET:-}" ]]; then
      echo "LOAD_TEST_SECRET is required for combined cloud-geo runs."
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
ZONE_SUFFIX=""
if [[ -n "$GEO_LOAD_ZONE" ]]; then
  ZONE_SUFFIX="-$(echo "$GEO_LOAD_ZONE" | tr ':' '-')"
fi
load_test_set_paths "cloud-geo-${SCENARIO}${ZONE_SUFFIX}"

echo "Launching k6 Cloud GEO run: $SCENARIO"
echo "Profile: cloud-geo (${GEO_STAKE_RATE}/s stakes, ${GEO_READER_VUS} readers, ${GEO_DURATION}, VU budget ${GEO_VU_BUDGET} = ${GEO_READER_VUS} read + ${GEO_STAKE_MAX_VUS} stake max)"
if [[ "$GEO_MULTI_ZONE" == "1" || "$GEO_MULTI_ZONE" == "true" ]]; then
  echo "Load zones: 3-region (US Ashburn + EU Dublin + AP Singapore) — requires paid k6 Cloud"
elif [[ -n "$GEO_LOAD_ZONE" ]]; then
  echo "Load zone: ${GEO_LOAD_ZONE} (single zone — Free Forever compatible)"
else
  echo "Load zone: ${GEO_DEFAULT_ZONE} (single zone default — Free Forever compatible)"
  echo "  Tip: 3-zone proof on free tier → ./load-tests/scripts/run-k6-cloud-geo-all-zones.sh"
fi
echo "Target: $BASE_URL"
echo "Local summary will be saved to $LOAD_TEST_JSON"
echo ""
echo "After the run completes, reset demo market data:"
echo "  ./infrastructure/dsql/reset-demo-market.sh"

CLOUD_ARGS=()
if [[ -n "${K6_CLOUD_PROJECT_ID:-}" ]]; then
  CLOUD_ARGS+=(--project-id "$K6_CLOUD_PROJECT_ID")
fi

set -o pipefail
k6 cloud run \
  "${CLOUD_ARGS[@]}" \
  --summary-export="$LOAD_TEST_JSON" \
  -e "BASE_URL=${BASE_URL}" \
  -e "LOAD_TEST_SECRET=${LOAD_TEST_SECRET:-}" \
  -e "K6_PROFILE=cloud-geo" \
  -e "GEO_STAKE_RATE=${GEO_STAKE_RATE}" \
  -e "GEO_DURATION=${GEO_DURATION}" \
  -e "GEO_READER_VUS=${GEO_READER_VUS}" \
  -e "GEO_VU_BUDGET=${GEO_VU_BUDGET}" \
  -e "GEO_STAKE_MAX_VUS=${GEO_STAKE_MAX_VUS}" \
  -e "GEO_MULTI_ZONE=${GEO_MULTI_ZONE}" \
  -e "GEO_LOAD_ZONE=${GEO_LOAD_ZONE}" \
  -e "GEO_DEFAULT_ZONE=${GEO_DEFAULT_ZONE}" \
  -e "K6_CLOUD_PROJECT_ID=${K6_CLOUD_PROJECT_ID:-}" \
  "$SCRIPT" 2>&1 | tee "$LOAD_TEST_LOG"

echo ""
echo "Summary exported to $LOAD_TEST_JSON"
echo "Full log saved to $LOAD_TEST_LOG"
echo "Grafana Cloud UI also has the full run dashboard (load zones map)."
echo "Run ./infrastructure/dsql/reset-demo-market.sh before your next demo."
