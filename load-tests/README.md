# Step 7 — Distributed Global Load Testing

Stress-tests the three production paths from `idea.md` using **[Grafana k6](https://k6.io/)** (HTTP) and a **Node MQTT soak** (IoT WebSocket fan-out).

## Why k6 (not Artillery)

| Factor | k6 | Artillery |
|---|---|---|
| Listed in `idea.md` | First choice | Second |
| Stack alignment | JavaScript scenarios | YAML + plugins |
| Global distribution | k6 Cloud load zones (US/EU/AP) | Artillery Pro |
| HTTP metrics | p95/p99, thresholds, Grafana | Good, less integrated |
| Future steps 10–12 | Grafana dashboards for demo screenshots | Possible but k6 fits hackathon narrative |

MQTT uses a separate Node script because k6 does not speak MQTT-over-WSS with Cognito guest auth — the soak reuses the same SDK pattern as `useTelemetryStream.ts`.

## What gets tested

```text
┌─────────────────────────────────────────────────────────────┐
│  k6 poll-read.js     →  GET /api/polls (edge-cached reads)  │
│  k6 poll-vote.js     →  POST /api/load-test/vote → DSQL     │
│  k6 combined.js      →  mixed readers + voters (live match) │
│  mqtt/subscriber-soak → IoT Core WSS + Cognito (telemetry)  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **k6** — [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)
2. **Config** — copy env template:

```bash
cp load-tests/.env.example load-tests/.env
# Edit LOAD_TEST_SECRET and verify AWS IoT / Cognito values
```

3. **Vercel** — enable vote load tests (temporary):

```bash
# Generate a secret, add to Vercel Production, redeploy
vercel env add LOAD_TEST_SECRET production
cd v01-uge-emiliano && vercel --prod
```

When `LOAD_TEST_SECRET` is unset, `POST /api/load-test/vote` returns **404** (invisible in production).

4. **MQTT deps** (first run only):

```bash
npm install --prefix load-tests/mqtt --omit=dev
```

## Quick start (smoke)

```bash
# Poll reads only (no secret required)
./load-tests/scripts/run-smoke.sh poll-read

# Poll writes (requires LOAD_TEST_SECRET on Vercel + in load-tests/.env)
./load-tests/scripts/run-smoke.sh poll-vote

# Mixed workload
./load-tests/scripts/run-smoke.sh combined

# IoT subscribers (run producer in another terminal)
cd telemetry_mock_data && node producer.js
./load-tests/scripts/run-mqtt-soak.sh --connections 25 --duration 30

# All paths
./load-tests/scripts/run-all-smoke.sh
```

## Stress (local, hundreds of VUs)

```bash
./load-tests/scripts/run-stress.sh combined
```

Profiles are defined in `load-tests/k6/lib/config.js`:

| Profile | Poll readers | Vote rate | Use case |
|---|---|---|---|
| `smoke` | 5–10 VUs | 2–5/s | CI / sanity |
| `stress` | up to 800 VUs | up to 300/s | Local machine max |
| `cloud` | up to 10k VUs | up to 3k/s | k6 Cloud global |

## Distributed global load (k6 Cloud)

1. Create a [Grafana Cloud k6](https://grafana.com/products/cloud/k6/) account
2. `k6 login cloud`
3. Optional: set `K6_CLOUD_PROJECT_ID` in `load-tests/.env`
4. Run:

```bash
./load-tests/scripts/run-k6-cloud.sh combined
```

Traffic is distributed across **US (Ashburn)**, **EU (Dublin)**, and **AP (Singapore)** — configured in each k6 script's `cloud.distribution` block.

## Results

JSON summaries are written to `load-tests/results/` (gitignored). k6 Cloud runs also appear in the Grafana Cloud UI with full latency histograms — useful for step 12 documentation screenshots.

## Thresholds (pass/fail)

Default thresholds in `load-tests/k6/lib/config.js`:

- `http_req_failed` < 5%
- `http_req_duration` p95 < 2s (reads), p95 < 3s (votes)
- `checks` > 95%
- `vote_success_rate` > 90%

Tune per your AWS/Vercel limits.

## Architecture notes

- **Vote endpoint** (`/api/load-test/vote`) calls the same `castVote` Server Action as the dashboard — tests the real Vercel → Aurora DSQL sharded write path, not a mock.
- **Unique viewer IDs** per k6 iteration avoid `already_voted` collisions during write tests.
- **Poll read** sleeps 2s between requests to mirror `SocialPanel` (`POLL_REFRESH_MS`).
- **MQTT soak** spawns N independent Cognito guest identities — same security model as production viewers.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `404` on vote endpoint | Set `LOAD_TEST_SECRET` on Vercel and redeploy |
| `403` on vote endpoint | Secret mismatch between `.env` and Vercel |
| MQTT connections fail | Check `AWS_IOT_ENDPOINT` and `COGNITO_IDENTITY_POOL_ID` |
| Zero MQTT messages | Run `telemetry_mock_data/producer.js` during soak |
| k6 Cloud auth error | Run `k6 login cloud` |

## Files

| Path | Purpose |
|---|---|
| `k6/poll-read.js` | Edge-cached poll totals |
| `k6/poll-vote.js` | DSQL sharded vote writes |
| `k6/combined.js` | Realistic mixed traffic |
| `k6/lib/config.js` | Profiles, thresholds, cloud zones |
| `mqtt/subscriber-soak.mjs` | IoT Core concurrent subscribers |
| `scripts/run-*.sh` | Runners for smoke / stress / cloud / mqtt |
| `v01-uge-emiliano/app/api/load-test/vote/route.ts` | Guarded vote API for k6 |
