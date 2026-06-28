#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run-mqtt-soak.sh — IoT Core MQTT subscriber soak (auto-stops)
#
# Usage: ./load-tests/scripts/run-mqtt-soak.sh [--connections 50] [--duration 60]
# Tip: run telemetry_mock_data/producer.js in another terminal for live messages.
#
# How often: RUN SPARINGLY — fine for one validation run; avoid high --connections
#   repeatedly. Default 50 subs × 60s is moderate; 500+ connections adds up on IoT/Cognito.
# Auto-stop: YES — exits after --duration seconds (default 60).
# Cost (one default run): ~$0 on AWS free tier (Cognito API calls + IoT connections).
#   Billing: AWS Console → Billing → Cost Explorer → filter IoT Core / Cognito.
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_TESTS="$ROOT/load-tests"
MQTT_DIR="$LOAD_TESTS/mqtt"

# shellcheck disable=SC1091
source "$LOAD_TESTS/scripts/lib/results.sh"

if [[ -f "$LOAD_TESTS/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LOAD_TESTS/.env"
  set +a
fi

if [[ ! -d "$MQTT_DIR/node_modules" ]]; then
  echo "Installing MQTT load-test dependencies..."
  npm install --prefix "$MQTT_DIR" --omit=dev
fi

export AWS_REGION="${AWS_REGION:-us-east-2}"
export AWS_IOT_ENDPOINT="${AWS_IOT_ENDPOINT:?Set AWS_IOT_ENDPOINT in load-tests/.env}"
export COGNITO_IDENTITY_POOL_ID="${COGNITO_IDENTITY_POOL_ID:?Set COGNITO_IDENTITY_POOL_ID in load-tests/.env}"
export TELEMETRY_TOPIC="${TELEMETRY_TOPIC:-esports/telemetry/M-1001}"

CONNECTIONS="${MQTT_CONNECTIONS:-50}"
DURATION="${MQTT_DURATION_SEC:-60}"

# Allow CLI overrides after script name
EXTRA_ARGS=("$@")
if [[ ${#EXTRA_ARGS[@]} -eq 0 ]]; then
  EXTRA_ARGS=(--connections "$CONNECTIONS" --duration "$DURATION")
fi

load_test_init_results "$LOAD_TESTS"
load_test_set_paths "mqtt-soak"

echo "MQTT soak: ${EXTRA_ARGS[*]}"
echo "Run producer in parallel: cd telemetry_mock_data && node producer.js"

set -o pipefail
node "$MQTT_DIR/subscriber-soak.mjs" \
  "${EXTRA_ARGS[@]}" \
  --output "$LOAD_TEST_JSON" 2>&1 | tee "$LOAD_TEST_LOG"

echo "Summary exported to $LOAD_TEST_JSON"
echo "Full log saved to $LOAD_TEST_LOG"
