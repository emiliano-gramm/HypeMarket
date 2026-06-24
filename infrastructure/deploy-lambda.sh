#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
RUNTIME="${LAMBDA_RUNTIME:-nodejs24.x}"
FUNCTION_NAME="${TELEMETRY_FANOUT_LAMBDA_NAME:-EsportsTelemetryFanout}"

cd "$ROOT/telemetry_fanout_lambda"

npm install --omit=dev
rm -f "$ROOT/telemetry_fanout_lambda.zip"
zip -r "$ROOT/telemetry_fanout_lambda.zip" index.js node_modules/ -q

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ROOT/telemetry_fanout_lambda.zip" \
  --region "$REGION"

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --runtime "$RUNTIME" \
  --region "$REGION" >/dev/null

echo "Lambda ${FUNCTION_NAME} updated (runtime: ${RUNTIME})."
