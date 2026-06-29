# Infrastructure

AWS backend for HypeMarket: Aurora DSQL (markets), DynamoDB + IoT Core (telemetry), and two Lambda functions.

**Region:** `us-east-2` (keep DSQL, DynamoDB, IoT, and Cognito in the same region).

**App env template:** [`dsql/cluster.env.example`](dsql/cluster.env.example) → copy to `v01-uge-emiliano/.env.local`

---

## Components

| Resource | Name (default) | Role |
|----------|----------------|------|
| DynamoDB table | `MatchTelemetry` | Telemetry source of truth, TTL 24h |
| Lambda | `EsportsTelemetryFanout` | Stream → IoT Core MQTT publish |
| Lambda | `UgePollTotalsAggregator` | Sum stake shards → `poll_totals` |
| IoT topic | `esports/telemetry/M-1001` | Live fan-out to browsers |
| Cognito Identity Pool | (guest) | Browser MQTT subscribe credentials |
| Aurora DSQL | `uge` schema | Wallets, shards, ledger, markets |

---

## Aurora DSQL

### Apply schema and seed (new cluster)

**Requires:** AWS CLI, `DSQL_HOST`, IAM permission for `dsql:GenerateDbConnectAdminAuthToken`.

With `psql` (PostgreSQL 16 client):

```bash
export DSQL_HOST=your-cluster.dsql.us-east-2.on.aws
export AWS_REGION=us-east-2
./infrastructure/dsql/apply-schema.sh
```

Without `psql`, the script falls back to Node (`apply-schema.mjs`).

Creates:

- `uge.polls`, `uge.poll_options`, `uge.vote_shards`, `uge.poll_totals`
- `uge.viewer_wallets`, `uge.wallet_ledger`, `uge.vote_events`
- Demo market for match `M-1001` ("Who wins Map 3?") with 50-credit house float per side

Set `DSQL_DEMO_POLL_ID=a1000001-0000-4000-8000-000000000001` in the app env (already in `cluster.env.example`).

### Reset demo market

Clears load-test pollution and returns the Map 3 market to open / 50-50 baseline:

```bash
./infrastructure/dsql/reset-demo-market.sh
```

Reads `DSQL_HOST` from `v01-uge-emiliano/.env.local` when unset. Uses batched deletes (Node) to stay within DSQL transaction limits.

---

## Lambda deploy

From repo root, with AWS CLI configured:

```bash
# Telemetry fan-out (DynamoDB Stream → IoT Core)
./infrastructure/deploy-lambda.sh

# Pool totals aggregator
./infrastructure/deploy-poll-aggregator-lambda.sh

# EventBridge schedule (aggregator every 1 minute, AWS minimum)
./infrastructure/setup-poll-aggregator-schedule.sh

# Manual aggregator invoke (debug)
./infrastructure/invoke-poll-aggregator.sh
```

Override names via env: `TELEMETRY_FANOUT_LAMBDA_NAME`, `POLL_AGGREGATOR_LAMBDA_NAME`, `AWS_REGION`.

Source:

- [`telemetry_fanout_lambda/`](../telemetry_fanout_lambda/)
- [`poll_aggregator_lambda/`](../poll_aggregator_lambda/)

---

## IAM policies (reference)

JSON policies in [`iam/`](iam/) for attaching to Lambda roles and the Vercel IAM user:

| File | Attach to |
|------|-----------|
| `lambda-telemetry-fanout-policy.json` | Fan-out Lambda role |
| `lambda-poll-aggregator-policy.json` | Aggregator Lambda role |
| `vercel-dynamodb-telemetry-read-policy.json` | Vercel IAM user (hydrate `GET /api/telemetry`) |
| `vercel-poll-aggregator-invoke-policy.json` | Vercel IAM user (async invoke after stake) |
| `cognito-unauth-iot-policy.json` | Cognito guest role (MQTT subscribe) |
| `cognito-unauth-trust-policy.json` | Cognito identity pool trust |

The Vercel IAM user also needs Aurora DSQL connect permissions for the app Server Actions (IAM auth token via `@aws-sdk/dsql-signer`).

---

## Telemetry producer (local demo)

Not deployed to AWS. Writes mock events from your machine:

```bash
cd telemetry_mock_data
npm install
node producer.js
```

Requires AWS credentials with `dynamodb:PutItem` on `MatchTelemetry`. The fan-out Lambda must be subscribed to the table stream and publishing to IoT Core for browsers to receive live updates.

---

## Provision helper

[`provision-dsql.sh`](provision-dsql.sh) documents or wraps cluster creation steps. Use when standing up a fresh environment; most hackathon/demo setups already have a cluster and only need `apply-schema.sh` + env vars.

---

## Related docs

- Root README: [`../README.md`](../README.md)
- Load tests: [`../load-tests/README.md`](../load-tests/README.md)
- App env and admin routes: [`../v01-uge-emiliano/README.md`](../v01-uge-emiliano/README.md)
