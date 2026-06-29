# Load testing

Stress-tests three production paths for **HypeMarket** using **[Grafana k6](https://k6.io/)** (HTTP) and a **Node MQTT soak** (IoT WebSocket fan-out).

> **Script names:** `poll-read.js` and `poll-vote.js` are legacy filenames. They hit `GET /api/markets` and the stake load-test endpoint for HypeMarket **markets**, not a separate polling product.

**Target deployment (default):** https://hypemarket-v0-aws.vercel.app

**App README:** [`../README.md`](../README.md)

---

## What gets tested

```text
k6 poll-read.js       →  GET /api/markets (edge-cached reads, 2s interval)
k6 poll-vote.js       →  POST /api/load-test/vote → placeStake (DSQL writes)
k6 combined.js        →  mixed readers + stakers (live-match shape)
mqtt/subscriber-soak  →  IoT Core MQTT over WSS (Cognito guest creds)
```

k6 does not speak MQTT-over-WSS with Cognito guest auth, so telemetry fan-out uses a separate Node script that mirrors `useTelemetryStream.ts`.

---

## Prerequisites

1. **k6** — [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

2. **Config file:**

```bash
cp load-tests/.env.example load-tests/.env
# Edit values (see load-tests/.env.example for all options)
```

3. **Stake writes on production** (temporary window only):

```bash
# Generate a secret, add to Vercel Production, redeploy
vercel env add LOAD_TEST_SECRET production
cd v01-uge-emiliano && vercel --prod
```

When `LOAD_TEST_SECRET` is unset on Vercel, `POST /api/load-test/vote` returns **404**.

4. **MQTT soak deps** (first run):

```bash
npm install --prefix load-tests/mqtt --omit=dev
```

---

## Quick start

### All smoke paths (~2–3 min)

```bash
./load-tests/scripts/run-all-smoke.sh
```

Runs market reads, stake writes (if `LOAD_TEST_SECRET` is in `.env`), and a short MQTT soak.

### Individual smoke scenarios

```bash
# Market reads only (no secret required)
./load-tests/scripts/run-smoke.sh poll-read

# Stake writes (requires LOAD_TEST_SECRET in load-tests/.env + on Vercel)
./load-tests/scripts/run-smoke.sh poll-vote

# Mixed readers + stakers
./load-tests/scripts/run-smoke.sh combined
```

### MQTT subscriber soak

Run the telemetry producer first:

```bash
cd telemetry_mock_data && node producer.js
```

In another terminal:

```bash
./load-tests/scripts/run-mqtt-soak.sh --connections 50 --duration 60
```

Set `AWS_IOT_ENDPOINT`, `COGNITO_IDENTITY_POOL_ID`, and `AWS_REGION` in `load-tests/.env`.

---

## Stress (local, auto-stops ~5 min)

```bash
./load-tests/scripts/run-stress.sh combined
./load-tests/scripts/run-stress.sh poll-vote
./load-tests/scripts/run-stress.sh poll-read
```

## Sustained operating point (local, ~5 min)

Flat **45 stakes/sec** (same `cloud-geo` profile as k6 Cloud geo, but local `k6 run`):

```bash
./load-tests/scripts/run-sustained.sh poll-vote
./load-tests/scripts/run-sustained.sh combined
```

Override duration or rate via `GEO_DURATION` / `GEO_STAKE_RATE` in `load-tests/.env`.

Profiles live in `load-tests/k6/lib/config.js`:

| Profile | Market readers | Stake rate | Use case |
|---------|----------------|------------|----------|
| `smoke` | 5–10 VUs | 2–5/s | Sanity check, safe to repeat |
| `stress` | up to 800 VUs | up to 300/s | Local saturation |
| `cloud-geo` | 25 VUs | 45/s sustained | k6 Cloud geo proof |
| `cloud` | up to 10k VUs | up to 3k/s | Optional saturation (burns VUh fast) |

After any write stress, reset the demo market:

```bash
./infrastructure/dsql/reset-demo-market.sh
```

---

## k6 Cloud (distributed load)

### Single multi-zone run

Requires [Grafana Cloud k6](https://grafana.com/products/cloud/k6/) and `k6 cloud login`.

```bash
./load-tests/scripts/run-k6-cloud-geo.sh poll-vote
./load-tests/scripts/run-k6-cloud-geo.sh combined
```

Defaults: **45 stakes/sec** (+ 25 market readers for `combined`) for **5 minutes**, load zone from `GEO_LOAD_ZONE` in `.env`.

### Free tier: one zone per run

Grafana Cloud Free allows one load zone per run. Run US, EU, and AP sequentially:

```bash
./load-tests/scripts/run-k6-cloud-geo-all-zones.sh poll-vote
```

Default: **2 minutes per zone** at 45/s (override with `GEO_DURATION=5m`).

### Optional saturation run

High VU count, burns quota quickly:

```bash
./load-tests/scripts/run-k6-cloud.sh combined
```

---

## Results and artifacts

Each runner writes timestamped files to `load-tests/results/` (gitignored):

| Runner | JSON summary | Full log |
|--------|--------------|----------|
| `run-smoke.sh poll-read` | `smoke-poll-read-YYYYMMDD-HHMMSS.json` | `.log` |
| `run-smoke.sh poll-vote` | `smoke-poll-vote-YYYYMMDD-HHMMSS.json` | `.log` |
| `run-stress.sh combined` | `stress-combined-YYYYMMDD-HHMMSS.json` | `.log` |
| `run-sustained.sh poll-vote` | `sustained-poll-vote-YYYYMMDD-HHMMSS.json` | `.log` |
| `run-mqtt-soak.sh` | `mqtt-soak-YYYYMMDD-HHMMSS.json` | `.log` |
| `run-k6-cloud-geo.sh` | `cloud-geo-*-YYYYMMDD-HHMMSS.json` | `.log` |

k6 Cloud runs also appear in the Grafana Cloud UI with full latency histograms.

### Reference numbers (Jun 2026, production)

| Metric | Value |
|--------|-------|
| Smoke stakes | 60 in 30s, 100% success, p95 ~453ms, 0 rollbacks |
| MQTT fan-out | ~121 msg/s, 50 subscribers |
| Sustained writes | ~45/s at 99.9% success, p95 638ms, 13,392 stakes in write-only stress |
| Combined saturation | ~28% stake success when ~800 readers compete with writers |

---

## How the stake endpoint works

- **`/api/load-test/vote`** calls the same `placeStake` Server Action as the dashboard (Vercel → Aurora DSQL: wallet debit, shard increment, ledger row).
- Default stake amount: **50** credits (matches UI chips). Override with `amount` in the JSON body.
- Each k6 iteration uses a **unique viewer ID**; wallets auto-provision with 1,000 credits on first stake.
- **`stake_occ_retries`**: OCC serialization retries from DSQL.
- **`stake_rollbacks`**: exhausted retries. Target **0** under normal sharded load.

Market read scenarios sleep **2s** between polls to mirror `useMarket()`.

---

## Pass/fail thresholds

Defaults in `load-tests/k6/lib/config.js`:

- `http_req_failed` < 5%
- `http_req_duration` p95 < 2s (reads), p95 < 3s (stakes)
- `checks` > 95%
- `stake_success_rate` > 90%

Peak stress profiles may **fail thresholds on purpose**. That is saturation data, not a broken deployment.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `404` on stake endpoint | Set `LOAD_TEST_SECRET` on Vercel and redeploy |
| `403` on stake endpoint | Secret mismatch between `load-tests/.env` and Vercel |
| MQTT connections fail | Check `AWS_IOT_ENDPOINT` and `COGNITO_IDENTITY_POOL_ID` in `.env` |
| Zero MQTT messages | Run `telemetry_mock_data/producer.js` during soak |
| k6 Cloud auth error | Run `k6 cloud login` or set `K6_CLOUD_TOKEN` + `K6_CLOUD_STACK_ID` |
| DSQL clutter after tests | `./infrastructure/dsql/reset-demo-market.sh` |

---

## File map

| Path | Purpose |
|------|---------|
| `k6/poll-read.js` | Edge-cached `GET /api/markets` |
| `k6/poll-vote.js` | DSQL sharded stake writes |
| `k6/combined.js` | Mixed read + write traffic |
| `k6/lib/config.js` | Profiles, thresholds, cloud zones |
| `mqtt/subscriber-soak.mjs` | Concurrent IoT Core subscribers |
| `scripts/run-*.sh` | Smoke, stress, cloud, MQTT runners |
| `.env.example` | Template for secrets and tuning |
| `../v01-uge-emiliano/app/api/load-test/vote/route.ts` | Guarded k6 stake API |
