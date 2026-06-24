#!/usr/bin/env bash
# Package and deploy (or create) UgePollTotalsAggregator Lambda.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
FUNCTION_NAME="${POLL_AGGREGATOR_LAMBDA_NAME:-UgePollTotalsAggregator}"
ROLE_NAME="${POLL_AGGREGATOR_LAMBDA_ROLE:-UgePollTotalsAggregatorLambdaRole}"
DSQL_HOST="${DSQL_HOST:-bbt3ywfpckyeao5op4g2dkgoti.dsql.us-east-2.on.aws}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

cd "$ROOT/poll_aggregator_lambda"
npm install --omit=dev
rm -f "$ROOT/poll_aggregator_lambda.zip"
zip -r "$ROOT/poll_aggregator_lambda.zip" index.js node_modules/ -q

if ! aws iam get-role --role-name "$ROLE_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "Creating IAM role ${ROLE_NAME}..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${ROOT}/infrastructure/iam/lambda-trust-policy.json" \
    --region "$REGION" >/dev/null

  aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name UgePollTotalsAggregatorPolicy \
    --policy-document "file://${ROOT}/infrastructure/iam/lambda-poll-aggregator-policy.json" \
    --region "$REGION"

  echo "Waiting for IAM role to propagate..."
  sleep 10
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "Updating Lambda ${FUNCTION_NAME}..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://${ROOT}/poll_aggregator_lambda.zip" \
    --region "$REGION" >/dev/null

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={DSQL_HOST=${DSQL_HOST}}" \
    --timeout 30 \
    --memory-size 256 \
    --region "$REGION" >/dev/null
else
  echo "Creating Lambda ${FUNCTION_NAME}..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file "fileb://${ROOT}/poll_aggregator_lambda.zip" \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={DSQL_HOST=${DSQL_HOST}}" \
    --region "$REGION" >/dev/null
fi

echo "Lambda ${FUNCTION_NAME} deployed."
