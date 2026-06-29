# HypeMarket - Live Esports Prediction Arena

**Hackathon:** [H0: Hack the Zero Stack](https://h01.devpost.com/) - Track 3: Million-scale Global App

**Live app:** https://hypemarket.vercel.app

**Build write-up:** https://dev.to/emiliano_xy/building-hypemarket-a-million-scale-esports-prediction-market-with-dynamodb-iot-core-and-vercel-2g3k

While a match streams, viewers spend free **Hype Credits** on real-time **parimutuel markets**. Implied odds come from the crowd's pooled stakes, not from the house. Live match telemetry (kills, objectives, positions) fans out over MQTT beside the market UI.

> **Play money only.** Hype Credits are non-redeemable. This is a prediction *simulation*, not real-money gambling.

---

## What this repo contains

| Path | Purpose |
|------|---------|
| [`v01-uge-emiliano/`](v01-uge-emiliano/) | Next.js app (dashboard, API routes, Server Actions) |
| [`infrastructure/`](infrastructure/) | Aurora DSQL schema/seed, IAM policies, Lambda deploy scripts |
| [`telemetry_mock_data/`](telemetry_mock_data/) | Mock match producer (`producer.js` → DynamoDB) |
| [`telemetry_fanout_lambda/`](telemetry_fanout_lambda/) | DynamoDB Stream → IoT Core MQTT fan-out |
| [`poll_aggregator_lambda/`](poll_aggregator_lambda/) | Materializes pool totals from stake shards |
| [`load-tests/`](load-tests/) | k6 HTTP load tests + Node MQTT subscriber soak |

---

## Architecture

Two workloads, two databases. Telemetry is append-only and identical for every viewer. Stakes are transactional (wallet debit, shared pool, settlement).

```text
Telemetry (fast, ephemeral)          Markets (transactional, auditable)
─────────────────────────            ───────────────────────────────────
producer.js → DynamoDB               Browser → placeStake (Server Action)
           → Stream → Fanout λ                  → Aurora DSQL vote_shards + ledger
           → IoT Core MQTT           Aggregator λ → poll_totals
           → all viewers (MQTT)      GET /api/markets (Vercel Edge CDN) → odds UI
reconnect → GET /api/telemetry       POST /api/markets/resolve → parimutuel payout
           → DynamoDB Query
```

| Layer | Stack | Role |
|-------|-------|------|
| Frontend | Next.js on Vercel, v0 layout | Dashboard, optimistic stake UI, MQTT client |
| Telemetry | DynamoDB, Lambda, IoT Core, Cognito guest | Ingest once, broadcast to all viewers |
| Markets | Aurora DSQL, aggregator Lambda | Sharded stake writes, wallet ledger, settlement |

AWS resources for this project are in **`us-east-2`**.

---

## Quick start (local app)

**Prerequisites:** Node.js 20+, npm, AWS credentials with access to your DSQL cluster (local dev only).

```bash
cd v01-uge-emiliano
npm install
cp ../infrastructure/dsql/cluster.env.example .env.local
# Fill in AWS credentials + IoT NEXT_PUBLIC_* vars (see table below)
npm run dev
```

Open http://localhost:3000

### Optional: live telemetry

In a second terminal:

```bash
cd telemetry_mock_data
npm install
node producer.js
```

The map and event feed show **Live** when IoT env vars are configured. The producer writes to DynamoDB every 500ms; the fan-out Lambda publishes to IoT Core.

### Reset demo market

After admin resolve or load tests:

```bash
./infrastructure/dsql/reset-demo-market.sh
```

Requires `DSQL_HOST` in `v01-uge-emiliano/.env.local` or the environment. Resets pools to the 50/50 house-float baseline for match `M-1001`.

---

## Environment variables

Copy [`infrastructure/dsql/cluster.env.example`](infrastructure/dsql/cluster.env.example) into `v01-uge-emiliano/.env.local`. Never commit `.env.local`.

### Server-side (Vercel + local)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DSQL_HOST` | Yes | Aurora DSQL cluster hostname |
| `DSQL_DEMO_POLL_ID` | Yes | Demo market UUID (`a1000001-0000-4000-8000-000000000001`) |
| `AWS_REGION` | Yes | e.g. `us-east-2` |
| `AWS_ACCESS_KEY_ID` | Local / Vercel | IAM user with DSQL, DynamoDB read, Lambda invoke |
| `AWS_SECRET_ACCESS_KEY` | Local / Vercel | Paired secret |
| `POLL_AGGREGATOR_LAMBDA_NAME` | Optional | Async pool refresh after stakes (`UgePollTotalsAggregator`) |
| `TELEMETRY_TABLE_NAME` | Optional | Default `MatchTelemetry` |
| `LOAD_TEST_SECRET` | Optional | Enables `POST /api/load-test/vote` (404 when unset) |
| `ADMIN_SECRET` | Optional | Enables market lock/resolve (404 when unset) |

### Client-side (`NEXT_PUBLIC_*`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_AWS_IOT_ENDPOINT` | For live map | IoT Core ATS endpoint |
| `NEXT_PUBLIC_AWS_REGION` | For live map | Same region as IoT / Cognito |
| `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` | For live map | Guest identity pool (subscribe-only) |
| `NEXT_PUBLIC_MATCH_ID` | Optional | Default `M-1001` |
| `NEXT_PUBLIC_STREAM_EMBED_URL` | Optional | Twitch / IVS embed URL |

---

## Demo flow (lock → resolve → payout)

With `ADMIN_SECRET` set locally or on Vercel:

```bash
export URL=http://localhost:3000   # or https://hypemarket.vercel.app
export ADMIN_SECRET=your-secret

# 1. Lock staking
curl -s -X POST "$URL/api/markets/resolve" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"action":"lock"}'

# 2. Resolve to Team Alpha (team-a) or Team Bravo (team-b)
curl -s -X POST "$URL/api/markets/resolve" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"winningOptionKey":"team-a"}'
```

Winners receive parimutuel payouts credited to their wallets. Run `./infrastructure/dsql/reset-demo-market.sh` before the next demo.

**Manual checklist:**

- [ ] `producer.js` running → map + feed show **Live**
- [ ] Stake on an outcome → wallet debits, odds shift
- [ ] Lock + resolve → payout banner, wallet balance updates
- [ ] `./infrastructure/dsql/reset-demo-market.sh` → market open, pools 50/50

---

## Load testing

Full docs: [`load-tests/README.md`](load-tests/README.md)

**Prerequisites:** [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed. For stake writes, set `LOAD_TEST_SECRET` on Vercel and in `load-tests/.env`.

```bash
cp load-tests/.env.example load-tests/.env
# Edit LOAD_TEST_SECRET, AWS IoT/Cognito vars for MQTT soak

# All smoke paths (~2–3 min)
./load-tests/scripts/run-all-smoke.sh

# Individual paths
./load-tests/scripts/run-smoke.sh poll-read
./load-tests/scripts/run-smoke.sh poll-vote      # needs LOAD_TEST_SECRET
./load-tests/scripts/run-smoke.sh combined

# MQTT fan-out (run producer in another terminal)
cd telemetry_mock_data && node producer.js
./load-tests/scripts/run-mqtt-soak.sh --connections 50 --duration 60

# Heavier local stress (~5 min, auto-stops)
./load-tests/scripts/run-stress.sh combined

# Reset market after stress
./infrastructure/dsql/reset-demo-market.sh
```

### Published scale numbers (Jun 2026)

Results from production and local runs against https://hypemarket.vercel.app:

| Run | Result |
|-----|--------|
| Smoke | Market reads 100% checks; 60 stakes / 30s at 100% success, p95 ~453ms, 0 OCC rollbacks |
| MQTT soak | 50 subscribers at ~121 msg/s with `producer.js` running |
| Write-only stress | 13,392 real stakes through DSQL (~44/s); sustained 45/s at 99.9% success, p95 638ms |
| Combined saturation | ~800 readers + stake writes competing: ~28% stake success (saturation data) |
| k6 Cloud geo | 45 stakes/s for 2 min per zone from US, EU, AP (load origin global; DSQL stays `us-east-2`) |

Artifacts land in `load-tests/results/` (gitignored). Reproduce with the scripts above.

---

## AWS setup (from scratch)

If you are deploying your own copy of the backend, see [`infrastructure/README.md`](infrastructure/README.md) for DSQL schema, Lambda deploy, IAM policies, and Cognito IoT guest access.

---

## Key API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/markets` | GET | Edge-cached market state + parimutuel odds |
| `/api/telemetry` | GET | Latest ~80 DynamoDB events (reconnect hydrate) |
| `/api/load-test/vote` | POST | Guarded stake endpoint for k6 (same `placeStake` path) |
| `/api/markets/resolve` | POST | Admin lock / resolve (requires `ADMIN_SECRET`) |

Server Actions in `v01-uge-emiliano/app/actions/markets.ts` handle wallet provisioning, sharded stakes, and settlement.

---

## Attribution

Built for [H0: Hack the Zero Stack](https://h01.devpost.com/). Frontend layout scaffolded with [Vercel v0](https://v0.dev); AWS data layer, MQTT client, market logic, and load tests are custom.

**Article:** [Building HypeMarket on DEV](https://dev.to/emiliano_xy/building-hypemarket-a-million-scale-esports-prediction-market-with-dynamodb-iot-core-and-vercel-2g3k)
