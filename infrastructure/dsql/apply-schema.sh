#!/usr/bin/env bash
# Apply schema + seed to Aurora DSQL via psql and IAM admin auth token.
# Requires: aws CLI, psql (PostgreSQL 16 client), jq
#
# Usage:
#   DSQL_HOST=your-cluster.dsql.us-east-2.on.aws ./infrastructure/dsql/apply-schema.sh
#   AWS_REGION=us-east-2  (optional, default us-east-2)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
DSQL_HOST="${DSQL_HOST:?Set DSQL_HOST to your cluster endpoint}"

if command -v psql >/dev/null 2>&1; then
  echo "Generating IAM auth token for ${DSQL_HOST}..."
  TOKEN="$(aws dsql generate-db-connect-admin-auth-token \
    --hostname "${DSQL_HOST}" \
    --region "${REGION}" \
    --expires-in 3600)"

  run_sql() {
    local file="$1"
    echo "Running ${file}..."
    PGPASSWORD="${TOKEN}" psql \
      "host=${DSQL_HOST} user=admin dbname=postgres sslmode=require" \
      -v ON_ERROR_STOP=1 \
      -f "${file}"
  }

  run_sql "${ROOT}/infrastructure/dsql/schema.sql"
  run_sql "${ROOT}/infrastructure/dsql/seed.sql"
  run_sql "${ROOT}/infrastructure/dsql/verify.sql"
else
  echo "psql not found — using Node.js apply script..."
  cd "${ROOT}/infrastructure/dsql"
  npm install --omit=dev --silent
  DSQL_HOST="${DSQL_HOST}" AWS_REGION="${REGION}" node apply-schema.mjs
fi

echo ""
echo "Schema applied successfully."
