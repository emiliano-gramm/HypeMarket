#!/usr/bin/env bash
# Reset demo HypeMarket + load-test pollution on Aurora DSQL (batched deletes).
# Requires: aws CLI, Node.js, npm deps in infrastructure/dsql/
#
# Usage (from repo root):
#   ./infrastructure/dsql/reset-demo-market.sh
#
# Reads DSQL_HOST and AWS_REGION from v01-uge-emiliano/.env.local when unset.
# Override batch size: RESET_BATCH_SIZE=400 (default)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/v01-uge-emiliano/.env.local"
REGION="${AWS_REGION:-us-east-2}"

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

if [[ -z "${DSQL_HOST:-}" ]]; then
  DSQL_HOST="$(load_env_var DSQL_HOST "$ENV_FILE")"
fi
if [[ -z "${AWS_REGION:-}" || "${AWS_REGION}" == "us-east-2" ]]; then
  from_env="$(load_env_var AWS_REGION "$ENV_FILE")"
  if [[ -n "$from_env" ]]; then
    REGION="$from_env"
  fi
fi

DSQL_HOST="${DSQL_HOST:?Set DSQL_HOST in the environment or v01-uge-emiliano/.env.local}"

echo "Running batched reset via Node (DSQL transaction row limits)..."
cd "${ROOT}/infrastructure/dsql"
npm install --omit=dev --silent
DSQL_HOST="${DSQL_HOST}" AWS_REGION="${REGION}" node reset-demo-market.mjs
