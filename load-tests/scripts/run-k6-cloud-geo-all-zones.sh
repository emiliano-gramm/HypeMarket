#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-k6-cloud-geo-all-zones.sh — 3 sequential single-zone k6 Cloud runs (Free tier)
#
# Grafana Cloud Free Forever allows max 1 load zone per run. This script runs the
# same cloud-geo profile three times from US, EU, and AP — for geo proof slides.
#
# Usage: ./load-tests/scripts/run-k6-cloud-geo-all-zones.sh [poll-vote|combined]
# Default: poll-vote (~2 min per zone, 45/s, 75 VUs — fits 100 VU cap)
#
# After all runs: ./infrastructure/dsql/reset-demo-market.sh
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCENARIO="${1:-poll-vote}"
DURATION="${GEO_DURATION:-2m}"

ZONES=(
  "amazon:us:ashburn|US (Ashburn)"
  "amazon:ie:dublin|EU (Dublin)"
  "amazon:sg:singapore|AP (Singapore)"
)

echo "Running cloud-geo in 3 single-zone passes (${DURATION} each) — Free Forever limit: 1 zone/run"
echo "Scenario: ${SCENARIO}"
echo ""

for entry in "${ZONES[@]}"; do
  zone="${entry%%|*}"
  label="${entry##*|}"
  echo "========== Zone: ${label} (${zone}) =========="
  GEO_LOAD_ZONE="$zone" GEO_DURATION="$DURATION" \
    "$ROOT/load-tests/scripts/run-k6-cloud-geo.sh" "$SCENARIO"
  echo ""
done

echo "All 3 zones complete. Reset demo market:"
echo "  ./infrastructure/dsql/reset-demo-market.sh"
