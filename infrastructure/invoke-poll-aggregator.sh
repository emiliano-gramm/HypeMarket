#!/usr/bin/env bash
# Manually invoke the poll totals aggregator (local testing / demo prep).
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
FUNCTION_NAME="${POLL_AGGREGATOR_LAMBDA_NAME:-UgePollTotalsAggregator}"

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --payload '{}' \
  /tmp/uge-poll-aggregator-out.json

echo "Response:"
cat /tmp/uge-poll-aggregator-out.json
echo ""
