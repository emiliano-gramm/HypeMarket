> **What this file is for:** Talking points and a loose script for your **YouTube demo video** or a live walkthrough / interview. The [H0 Hackathon](https://h01.devpost.com/) requires a **sub-3-minute demo video** showing the working app, the problem, and the AWS database used — use this as your outline. Record screen footage of the live dashboard + AWS Console where noted.

---

# Technical Video — Talking Points & Demo Script

**Target length:** 2:30–2:50 (under 3 min)  
**Live URL:** https://ultimate-global-entertainment.vercel.app  
**Track:** Million-scale Global App (esports / entertainment second screen)

---

## 0:00–0:25 — Hook & problem

**Say:**

- "This is Ultimate Global Entertainment — a live esports second screen."
- "Fans want kills, positions, and polls updating in sync with the match — at scale that's millions of viewers hitting the same data."
- "We solve that with a decoupled pipeline: DynamoDB for writes, IoT Core for real-time fan-out, Vercel for the frontend."

**Show:** Dashboard homepage loading (dark command-center UI).

---

## 0:25–0:50 — Architecture (one sentence per box)

**Say:**

- "A mock producer simulates game events every 500 milliseconds."
- "Events land in DynamoDB — that's our source of truth."
- "A DynamoDB Stream triggers Lambda, which publishes to AWS IoT Core over MQTT."
- "Every browser subscribes to the same topic — one publish, millions of recipients. That's fan-out."

**Show:** Architecture diagram (draw.io, Mermaid export, or whiteboard slide). Optional: quick flash of `explanation.md` diagram.

```text
producer.js → DynamoDB → Stream → Lambda → IoT Core → Next.js on Vercel
```

---

## 0:50–1:30 — Live demo (the money shot)

**Before recording:** Start the producer in a terminal:

```bash
cd telemetry_mock_data && node producer.js
```

**Show (split screen or sequential):**

1. **Terminal** — `Inserted event for Player_X` every ~500ms
2. **Browser** — https://ultimate-global-entertainment.vercel.app
   - Connection badge: green **Live**
   - Event feed scrolling (Kill / Assist / Objective / Movement)
   - Arena map — colored dots moving
   - Kill / Objective counters incrementing
3. **(Optional, strong for judges)** AWS Console → IoT Core → MQTT test client subscribed to `esports/telemetry/M-1001` — same JSON appearing

**Say:**

- "Same event path from producer to dashboard in under a second."
- "No polling — the browser holds an MQTT WebSocket subscription through IoT Core."

---

## 1:30–2:00 — AWS database & data model

**Say:**

- "Amazon DynamoDB is the designated AWS database for this submission."
- "Single-table design: partition key `MATCH#M-1001`, sort key `EVENT#timestamp#uuid`."
- "TTL on `ExpiryTimestamp` keeps the table lean — events expire after 24 hours."
- "Streams give us a change log; Lambda reacts to inserts only."

**Show:** AWS Console → DynamoDB → `MatchTelemetry` → Explore table items (rows appearing while producer runs). **Screenshot this for the Devpost submission.**

---

## 2:00–2:25 — Frontend & security

**Say:**

- "Frontend is Next.js deployed on Vercel."
- "Browsers can't hold AWS secret keys — Cognito Identity Pool issues temporary guest credentials."
- "The IoT SDK connects over WebSocket, subscribes to the match topic, and drives the dashboard."
- "Social panel is scaffolded — polls and chat will use Aurora DSQL with sharded counters next."

**Show:** Dashboard panels — stream placeholder, telemetry map, social sidecar.

---

## 2:25–2:50 — Close

**Say:**

- "This is built for the million-scale track: decoupled writes, native pub/sub fan-out, edge-hosted UI."
- "DynamoDB persists and audits; IoT Core distributes; Vercel ships the experience."
- "Link in the description. Built for #H0Hackathon."

**Show:** Full dashboard one more time with events flowing.

---

## Quick reference — if asked in Q&A

### Producer

- File: `telemetry_mock_data/producer.js`
- Table: `MatchTelemetry`, region `us-east-2`
- Interval: 500ms
- Run: `node producer.js` · Stop: `Ctrl+C`

### Data model

| Key | Pattern |
|---|---|
| PK | `MATCH#M-1001` |
| SK | `EVENT#<timestamp>#<uuid>` |
| Attributes | `PlayerId`, `Action`, `CoordinateX/Y`, `ExpiryTimestamp` |

### AWS resources

| Resource | Name |
|---|---|
| DynamoDB | `MatchTelemetry` (+ stream, `NEW_IMAGE`) |
| Lambda | `EsportsTelemetryFanout` |
| IoT topic | `esports/telemetry/M-1001` |
| Cognito pool | `EsportsTelemetryPool` |
| Vercel project | `ultimate-global-entertainment` |

### Why IoT Core over API Gateway WebSocket?

- One-to-many broadcast — same payload to all viewers
- Lambda publishes once; broker handles fan-out
- Avoids per-client push loops at scale

### What is NOT done yet (honest answer)

- Aurora DSQL for real poll/chat persistence (sharded counters)
- Live video embed (set `NEXT_PUBLIC_STREAM_EMBED_URL`)
- Chat is placeholder UI

---

## Devpost submission checklist

- [ ] Demo video uploaded (YouTube, < 3 min)
- [ ] Text description mentions **DynamoDB**
- [ ] Vercel project link: https://ultimate-global-entertainment.vercel.app
- [ ] Vercel Team ID included
- [ ] Architecture diagram attached
- [ ] AWS Console screenshot (DynamoDB table or IoT/Lambda)
- [ ] Optional: publish `blog.md` to Medium/LinkedIn with #H0Hackathon

---

## Recording tips

- Use 1080p screen capture; zoom terminal font to 14–16px
- Hide unrelated browser tabs
- If "Live" badge shows Error, check producer is running and env vars on Vercel
- Record MQTT test client clip only if it works cleanly — dashboard alone is enough

---

*Last updated: June 22, 2026*
