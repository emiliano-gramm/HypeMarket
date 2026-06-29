# HypeMarket (Next.js)

Live esports prediction dashboard: parimutuel staking, MQTT telemetry map, and wallet settlement.

**Root docs:** [../README.md](../README.md) (architecture, env vars, demo, load tests)

**Build write-up:** https://dev.to/emiliano_xy/building-hypemarket-a-million-scale-esports-prediction-market-with-dynamodb-iot-core-and-vercel-2g3k

**Live:** https://hypemarket.vercel.app

---

## Quick start

```bash
npm install
cp ../infrastructure/dsql/cluster.env.example .env.local
# Add AWS credentials + NEXT_PUBLIC_* IoT vars — see root README
npm run dev
```

Open http://localhost:3000

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |

---

## Project layout

| Path | Purpose |
|------|---------|
| `app/` | App Router pages, API routes, Server Actions |
| `app/actions/markets.ts` | `placeStake`, wallet, lock, resolve, settlement |
| `app/api/markets/` | Edge-cached market reads |
| `app/api/telemetry/` | DynamoDB hydrate for reconnect |
| `app/api/load-test/vote/` | Guarded k6 stake endpoint |
| `app/api/markets/resolve/` | Admin lock / resolve |
| `components/hypemarket/` | v0-scaffolded UI (market panel, map rail, themes) |
| `components/dashboard/` | Telemetry map/feed, connection badge |
| `lib/markets/` | Odds math, `useMarket()` hook, DSQL queries |
| `lib/telemetry/` | MQTT stream hook, momentum, DynamoDB types |

---

## Environment

Copy [`../infrastructure/dsql/cluster.env.example`](../infrastructure/dsql/cluster.env.example) to `.env.local`. Full variable table: [root README](../README.md#environment-variables).

Minimum for **markets only** (no live map):

- `DSQL_HOST`, `DSQL_DEMO_POLL_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

Add for **live telemetry**:

- `NEXT_PUBLIC_AWS_IOT_ENDPOINT`, `NEXT_PUBLIC_AWS_REGION`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`

Optional:

- `LOAD_TEST_SECRET` — enables `/api/load-test/vote`
- `ADMIN_SECRET` — enables `/api/markets/resolve`
- `POLL_AGGREGATOR_LAMBDA_NAME` — async `poll_totals` refresh after stakes

---

## Deploy (Vercel)

```bash
vercel link
vercel env pull .env.local   # or set vars in the Vercel dashboard
vercel --prod
```

Set the same server and `NEXT_PUBLIC_*` variables in the Vercel project. Attach IAM policies from [`../infrastructure/iam/`](../infrastructure/iam/) to the credentials used by the deployment.

---

## Admin demo (local or production)

```bash
export URL=http://localhost:3000
export ADMIN_SECRET=your-secret

curl -X POST "$URL/api/markets/resolve" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"action":"lock"}'

curl -X POST "$URL/api/markets/resolve" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"winningOptionKey":"team-a"}'
```

Then reset: `../infrastructure/dsql/reset-demo-market.sh`

---

## Stack

- **Next.js 16** (App Router, Server Actions)
- **Aurora DSQL** via `pg` + `@aws-sdk/dsql-signer`
- **DynamoDB** + **IoT Core** via `aws-iot-device-sdk-v2` + Cognito guest credentials
- **Tailwind CSS 4**, **Framer Motion**

UI layout started from [Vercel v0](https://v0.dev); AWS wiring and market logic are custom.
