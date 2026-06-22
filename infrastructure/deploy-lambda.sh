#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/telemetry_fanout_lambda"

npm install --omit=dev
rm -f "$ROOT/telemetry_fanout_lambda.zip"
zip -r "$ROOT/telemetry_fanout_lambda.zip" index.js node_modules/ -q

aws lambda update-function-code \
  --function-name EsportsTelemetryFanout \
  --zip-file "fileb://$ROOT/telemetry_fanout_lambda.zip" \
  --region us-east-2

echo "Lambda EsportsTelemetryFanout updated."
