#!/usr/bin/env bash
# Provision a single-Region Aurora DSQL cluster for social/poll state.
# Usage: ./infrastructure/provision-dsql.sh [region]
set -euo pipefail

REGION="${1:-us-east-2}"

echo "Creating Aurora DSQL cluster in ${REGION}..."
RESPONSE="$(aws dsql create-cluster \
  --region "${REGION}" \
  --tags Name=uge-esports-social,Project=UltimateGlobalEntertainment \
  --deletion-protection-enabled \
  --output json)"

IDENTIFIER="$(echo "${RESPONSE}" | jq -r '.identifier')"
ENDPOINT="$(echo "${RESPONSE}" | jq -r '.endpoint')"
ARN="$(echo "${RESPONSE}" | jq -r '.arn')"

echo ""
echo "Cluster created (status may be CREATING for a few minutes)."
echo "  Identifier: ${IDENTIFIER}"
echo "  Endpoint:   ${ENDPOINT}"
echo "  ARN:        ${ARN}"
echo ""
echo "Wait until Active:"
echo "  aws dsql get-cluster --identifier ${IDENTIFIER} --region ${REGION} --query status"
echo ""
echo "Then apply schema:"
echo "  DSQL_HOST=${ENDPOINT} ./infrastructure/dsql/apply-schema.sh"
echo ""
echo "Add to v01-uge-emiliano/.env.local (server-side only, not NEXT_PUBLIC_):"
echo "  DSQL_HOST=${ENDPOINT}"
echo "  AWS_REGION=${REGION}"
