#!/usr/bin/env bash
# Reset the demo HypeMarket poll to a clean 50/50 baseline on Aurora DSQL.
# Requires: aws CLI; psql (PostgreSQL 16 client) OR Node.js for fallback.
#
# Usage (from repo root):
#   ./infrastructure/dsql/reset-demo-market.sh
#
# Reads DSQL_HOST and AWS_REGION from v01-uge-emiliano/.env.local when unset.
# Override explicitly:
#   DSQL_HOST=your-cluster.dsql.us-east-2.on.aws ./infrastructure/dsql/reset-demo-market.sh
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

if command -v psql >/dev/null 2>&1; then
  echo "Generating IAM auth token for ${DSQL_HOST}..."
  TOKEN="$(aws dsql generate-db-connect-admin-auth-token \
    --hostname "${DSQL_HOST}" \
    --region "${REGION}" \
    --expires-in 3600)"

  echo "Running reset-demo-market.sql..."
  PGPASSWORD="${TOKEN}" psql \
    "host=${DSQL_HOST} user=admin dbname=postgres sslmode=require" \
    -v ON_ERROR_STOP=1 \
    -f "${ROOT}/infrastructure/dsql/reset-demo-market.sql"
else
  echo "psql not found — using Node.js reset script..."
  cd "${ROOT}/infrastructure/dsql"
  npm install --omit=dev --silent
  DSQL_HOST="${DSQL_HOST}" AWS_REGION="${REGION}" node reset-demo-market.mjs
fi

echo ""
echo "Demo market reset complete — pools should be team-a 50 / team-b 50."
