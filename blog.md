> **What this file is for:** A publishable blog post draft for **Medium, LinkedIn, or dev.to** — written to satisfy the optional bonus content requirement for the [H0 Hackathon](https://h01.devpost.com/). Copy, adapt tone if needed, and add the required disclosure line before publishing. Use hashtag **#H0Hackathon** when sharing on social media.

---

# Building a Million-Scale Esports Second Screen with DynamoDB, IoT Core, and Vercel

*I created this piece of content for the purposes of entering the H0: Hack the Zero Stack hackathon (#H0Hackathon).*

## The problem

Esports fans do not just watch the stream — they want a **second screen**: live kill feeds, player positions, polls, and chat, all updating in sync with the match. At scale, that is two hard problems at once:

1. **Ingestion** — game telemetry arrives every few hundred milliseconds.
2. **Distribution** — the same update must reach thousands or millions of viewers without melting your database or opening a WebSocket per client in custom server code.

I am building **Ultimate Global Entertainment** for Track 3 (Million-scale Global App) of the hackathon: a live-event platform that decouples fast telemetry writes from global real-time fan-out.

**Live demo:** [ultimate-global-entertainment.vercel.app](https://ultimate-global-entertainment.vercel.app)

## The stack at a glance

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js on Vercel | Live command-center dashboard |
| Telemetry store | Amazon DynamoDB | Source of truth for match events |
| Event bridge | DynamoDB Streams + Lambda | Reacts to new rows, publishes to MQTT |
| Real-time fan-out | AWS IoT Core | One-to-many broadcast to all viewers |
| Browser auth | Cognito Identity Pool | Temporary credentials — no IAM keys in JS |
| Social state (planned) | Aurora DSQL | Sharded counters for polls and leaderboards |

## Why DynamoDB for telemetry

Game events are append-only, high-frequency, and short-lived. DynamoDB fits naturally:

- **Single-table design** — partition key `MATCH#M-1001`, sort key `EVENT#<timestamp>#<uuid>`
- **TTL on `ExpiryTimestamp`** — rows auto-delete after 24 hours
- **On-demand billing** — no capacity planning during a spike

A mock producer (`telemetry_mock_data/producer.js`) simulates a live match, writing a new event every 500ms with player ID, action (Kill, Assist, Objective, Movement), and map coordinates.

## Why not poll the database from the browser?

Polling DynamoDB from every viewer would be slow, expensive, and would hit read limits fast. Instead, we treat DynamoDB as the **ledger** and use a separate path for **live delivery**.

```
producer.js → DynamoDB → Stream → Lambda → IoT Core → Browser dashboard
```

1. **Producer** writes to DynamoDB only.
2. **DynamoDB Stream** emits a change log on every insert.
3. **Lambda** (`EsportsTelemetryFanout`) reads new rows and publishes JSON to MQTT topic `esports/telemetry/M-1001`.
4. **IoT Core** fans that single publish out to every subscribed browser.
5. **Next.js on Vercel** subscribes over MQTT WebSocket and renders a live telemetry panel.

This keeps ingestion and distribution decoupled. If the broadcast hiccups, events are still in DynamoDB for replay.

## Why IoT Core instead of API Gateway WebSocket?

Esports telemetry is **one-to-many**: everyone sees the same game state. With API Gateway WebSocket, you often end up looping over connected clients in Lambda to push the same payload N times.

IoT Core is a managed MQTT broker built for pub/sub fan-out. Lambda publishes **once**; the broker handles delivery to all subscribers. That is the difference between a prototype and something that can grow toward million-scale concurrency.

## The frontend: subscribing securely from the browser

Browsers cannot hold AWS secret keys. The dashboard uses a **Cognito Identity Pool** with guest (unauthenticated) access:

1. Browser requests temporary credentials from Cognito.
2. `aws-iot-device-sdk-v2` opens a signed WebSocket to IoT Core.
3. The app subscribes to `esports/telemetry/M-1001` and updates the UI in real time.

Public env vars (`NEXT_PUBLIC_AWS_IOT_ENDPOINT`, `NEXT_PUBLIC_AWS_REGION`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`) are safe to expose — security is enforced by the guest IAM role (subscribe-only on telemetry topics).

The dashboard includes:

- **Live stream panel** — embed slot for Twitch/IVS (optional `NEXT_PUBLIC_STREAM_EMBED_URL`)
- **Arena map** — player positions from coordinate telemetry
- **Event feed** — scrolling kill/assist/objective log
- **Social sidecar** — poll and chat scaffold (Aurora DSQL sharded counters coming next)

## Lessons from building the pipeline

**Sort keys need uniqueness at speed.** `Date.now()` alone can collide under rapid writes. We append `crypto.randomUUID()` to the sort key.

**TTL is a table setting.** Writing `ExpiryTimestamp` does nothing until DynamoDB TTL is enabled on that attribute.

**Decouple write and broadcast paths.** The producer never talks to IoT. That makes testing, replay, and future consumers (analytics, alerts) much simpler.

**Browser SDK ≠ Node SDK.** The IoT device SDK has a separate browser entry point and needs a custom Cognito credentials provider — the Node credential chain does not bundle into Next.js.

## What is next

- **Aurora DSQL** for global poll votes and leaderboards using a sharded counter pattern (avoids OCC write collisions)
- **Vercel Edge caching** for static match metadata (`Cache-Control: s-maxage=1, stale-while-revalidate`)
- **Real chat** wiring on the social panel

## Takeaway

You do not need a custom message broker to ship a real-time esports second screen. DynamoDB for persistence, Streams + Lambda for event processing, IoT Core for browser fan-out, and Vercel for the frontend is a production-shaped pattern — not just a weekend demo.

The same architecture that handles a hackathon mock producer can absorb real game-server webhooks, replay from DynamoDB, and scale viewers through IoT Core without redesigning the core data path.

---

**Links**

- Live app: https://ultimate-global-entertainment.vercel.app
- Hackathon: https://h01.devpost.com/
- Repo docs: `explanation.md` (full pipeline reference), `talk.md` (video script)

**Hashtags:** `#H0Hackathon` `#AWS` `#DynamoDB` `#IoT` `#Vercel` `#esports` `#serverless`
