#!/usr/bin/env bash
# Clear demo telemetry events from DynamoDB MatchTelemetry.
# Requires: aws CLI credentials, Node.js, npm deps in telemetry_mock_data/
#
# Usage (from repo root):
#   ./telemetry_mock_data/clear-telemetry.sh
#   ./telemetry_mock_data/clear-telemetry.sh --dry-run
#
# Reads AWS_REGION and NEXT_PUBLIC_MATCH_ID from v01-uge-emiliano/.env.local when unset.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/v01-uge-emiliano/.env.local"
REGION="${AWS_REGION:-us-east-2}"
MATCH_ID="${MATCH_ID:-}"

load_env_var() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#"${key}="}"
  line="${line%$'\r'}"
  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  printf '%s' "$line"
}

if [[ -z "${AWS_REGION:-}" || "${AWS_REGION}" == "us-east-2" ]]; then
  from_env="$(load_env_var AWS_REGION "$ENV_FILE")"
  if [[ -n "$from_env" ]]; then
    REGION="$from_env"
  fi
fi

if [[ -z "$MATCH_ID" ]]; then
  MATCH_ID="$(load_env_var NEXT_PUBLIC_MATCH_ID "$ENV_FILE")"
fi
MATCH_ID="${MATCH_ID:-M-1001}"

echo "Clearing DynamoDB telemetry (match ${MATCH_ID}, region ${REGION})..."
cd "${ROOT}/telemetry_mock_data"
npm install --omit=dev --silent
AWS_REGION="${REGION}" MATCH_ID="${MATCH_ID}" node clear-telemetry.mjs "$@"
