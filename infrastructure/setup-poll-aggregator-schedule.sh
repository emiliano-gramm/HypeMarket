#!/usr/bin/env bash
# EventBridge schedule + permission for UgePollTotalsAggregator (rate: 1 minute — AWS minimum).
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
FUNCTION_NAME="${POLL_AGGREGATOR_LAMBDA_NAME:-UgePollTotalsAggregator}"
RULE_NAME="${POLL_AGGREGATOR_RULE_NAME:-UgePollTotalsAggregatorSchedule}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

echo "Creating/updating EventBridge rule ${RULE_NAME} (rate 1 minute)..."
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(1 minute)" \
  --state ENABLED \
  --description "Refresh uge.poll_totals from vote_shards" \
  --region "$REGION" >/dev/null

RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"

aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id=1,Arn=${FUNCTION_ARN}" \
  --region "$REGION" >/dev/null

aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "${RULE_NAME}-invoke" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" \
  --region "$REGION" 2>/dev/null || true

echo "Schedule active: ${RULE_NAME} -> ${FUNCTION_NAME} every 1 minute."
echo "For immediate refresh after votes, set POLL_AGGREGATOR_LAMBDA_NAME on Vercel."
