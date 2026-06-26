# HypeMarket — Live Esports Prediction Arena

**Hackathon:** [H0: Hack the Zero Stack](https://h01.devpost.com/) — Track 3: Million-scale Global App

**Live app:** https://ultimate-global-entertainment.vercel.app

While a match streams, viewers spend free **Hype Credits** to stake on outcomes in real-time **parimutuel markets**. Implied odds come from the crowd’s pooled stakes—not from us. Live match telemetry (kills, objectives, positions) fans out over MQTT beside the market UI so momentum and staking feel connected.

> **Play money only.** Hype Credits are non-redeemable. This is a prediction *simulation*, not real-money gambling.

---

## Architecture (two velocities, two databases)

```text
Telemetry (fast, ephemeral)          Markets (transactional, auditable)
─────────────────────────            ───────────────────────────────────
producer.js → DynamoDB               Browser → Next.js (Vercel)
           → Stream → Lambda                    → placeStake (Server Action)
           → IoT Core MQTT                      → Aurora DSQL (sharded pools,
           → all viewers (map, feed)              wallet, append-only ledger)
                                              → GET /api/markets (edge-cached odds)
                                              → resolve + parimutuel settlement
```

| Layer | Stack | Role |
|---|---|---|
| Frontend | Next.js on Vercel, v0 layout | Dashboard, optimistic stake UI, MQTT client |
| Telemetry | DynamoDB, Lambda, IoT Core, Cognito guest | Ingest once, broadcast to millions |
| Markets | Aurora DSQL, aggregator Lambda | Sharded stake writes, wallet ledger, settlement |

<!-- TODO: add architecture diagram PNG for Devpost -->

---

## Repository layout

| Path | Purpose |
|---|---|
| `v01-uge-emiliano/` | Next.js app (HypeMarket UI + API routes) |
| `infrastructure/` | DSQL schema/seed, IAM policies, Lambda deploy scripts |
| `telemetry_mock_data/` | Local match event producer (`producer.js`) |
| `telemetry_fanout_lambda/` | DynamoDB Stream → IoT Core fan-out |
| `poll_aggregator_lambda/` | Materializes pool totals from stake shards |
| `load-tests/` | k6 HTTP + MQTT soak scripts |

---

## Local development

### 1. App

```bash
cd v01-uge-emiliano
npm install
cp ../infrastructure/dsql/cluster.env.example .env.local
# Add remaining vars from the table below, then:
npm run dev
```

Open http://localhost:3000

### 2. Live telemetry (optional)

In a second terminal:

```bash
cd telemetry_mock_data
npm install
node producer.js
```

The dashboard map and event feed update when IoT env vars are set.

### 3. Reset demo market (after resolve)

```bash
./infrastructure/dsql/reset-demo-market.sh
```

---

## Environment variables

Copy DSQL settings from [`infrastructure/dsql/cluster.env.example`](infrastructure/dsql/cluster.env.example) into `v01-uge-emiliano/.env.local`. Never commit `.env.local`.

### Server-side (Vercel + local)

| Variable | Required | Purpose |
|---|---|---|
| `DSQL_HOST` | Yes | Aurora DSQL cluster hostname |
| `DSQL_DEMO_POLL_ID` | Yes | Demo market row UUID |
| `AWS_REGION` | Yes | e.g. `us-east-2` |
| `AWS_ACCESS_KEY_ID` | Local / Vercel | IAM user with DSQL + DynamoDB + Lambda invoke |
| `AWS_SECRET_ACCESS_KEY` | Local / Vercel | Paired secret |
| `POLL_AGGREGATOR_LAMBDA_NAME` | Optional | Async pool refresh after stakes |
| `TELEMETRY_TABLE_NAME` | Optional | Default `MatchTelemetry` |
| `LOAD_TEST_SECRET` | Optional | Enables `POST /api/load-test/vote` (404 when unset) |
| `ADMIN_SECRET` | Optional | Enables market lock/resolve routes (404 when unset) |

### Client-side (`NEXT_PUBLIC_*`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_AWS_IOT_ENDPOINT` | For live map | IoT Core ATS endpoint |
| `NEXT_PUBLIC_AWS_REGION` | For live map | Same region as IoT / Cognito |
| `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` | For live map | Guest identity pool (subscribe-only) |
| `NEXT_PUBLIC_MATCH_ID` | Optional | Default `M-1001` |
| `NEXT_PUBLIC_STREAM_EMBED_URL` | Optional | Twitch / IVS embed URL |

---

## Load testing

See [`load-tests/README.md`](load-tests/README.md) for k6 profiles (smoke / stress / cloud) and MQTT subscriber soak.

```bash
./load-tests/scripts/run-all-smoke.sh
```

---

## Demo checklist

- [ ] `producer.js` running → map + feed show **Live**
- [ ] Stake on an outcome → wallet debits, odds shift, toast confirms
- [ ] Lock + resolve (admin) → winners paid from pool, banner shows payout
- [ ] <!-- TODO: link to demo video -->
- [ ] <!-- TODO: Devpost submission URL -->

---

## License / attribution

<!-- TODO: license if applicable -->

Built for H0: Hack the Zero Stack. Frontend scaffolded with [Vercel v0](https://v0.dev); AWS data layer and integrations are custom.
