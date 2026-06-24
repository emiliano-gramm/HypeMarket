#!/usr/bin/env node
/**
 * MQTT subscriber soak — stress-tests IoT Core WebSocket fan-out path.
 * Spawns N concurrent subscribers (same Cognito guest flow as the dashboard).
 *
 * Run telemetry producer in parallel for live messages:
 *   cd telemetry_mock_data && node producer.js
 *
 * Usage:
 *   node subscriber-soak.mjs --connections 50 --duration 60
 */
import { connectSubscriber, getMqttConfigFromEnv } from "./cognito-credentials.mjs";

function parseArgs(argv) {
  const options = {
    connections: 25,
    durationSec: 60,
    rampMs: 100,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--connections" && argv[i + 1]) {
      options.connections = Number(argv[++i]);
    } else if (arg === "--duration" && argv[i + 1]) {
      options.durationSec = Number(argv[++i]);
    } else if (arg === "--ramp-ms" && argv[i + 1]) {
      options.rampMs = Number(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node subscriber-soak.mjs [options]

Options:
  --connections <n>   Concurrent MQTT subscribers (default: 25)
  --duration <sec>    Soak duration in seconds (default: 60)
  --ramp-ms <ms>      Delay between connection spawns (default: 100)

Environment (from load-tests/.env or shell):
  AWS_IOT_ENDPOINT, COGNITO_IDENTITY_POOL_ID, AWS_REGION, TELEMETRY_TOPIC
`);
      process.exit(0);
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spawnSubscriber(index, config) {
  const clientId = `loadtest-${index}-${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();

  try {
    const subscriber = await connectSubscriber({
      ...config,
      clientId,
    });

    return {
      index,
      clientId,
      ok: true,
      connectedMs: Date.now() - startedAt,
      subscriber,
    };
  } catch (err) {
    return {
      index,
      clientId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      connectedMs: Date.now() - startedAt,
    };
  }
}

async function main() {
  const { connections, durationSec, rampMs } = parseArgs(process.argv);
  const config = getMqttConfigFromEnv();

  console.log(
    JSON.stringify({
      event: "mqtt_soak_start",
      connections,
      durationSec,
      topic: config.topic,
      endpoint: config.endpoint,
    })
  );

  const subscribers = [];

  for (let i = 0; i < connections; i += 1) {
    const result = await spawnSubscriber(i, config);
    subscribers.push(result);
    if (result.ok) {
      process.stdout.write(".");
    } else {
      process.stdout.write("x");
    }
    if (rampMs > 0) {
      await sleep(rampMs);
    }
  }
  console.log("");

  const connected = subscribers.filter((s) => s.ok);
  const failed = subscribers.filter((s) => !s.ok);

  console.log(
    `Connected: ${connected.length}/${connections} (${failed.length} failed)`
  );

  if (connected.length === 0) {
    console.error(JSON.stringify({ event: "mqtt_soak_failed", failed }, null, 2));
    process.exit(1);
  }

  console.log(`Soaking for ${durationSec}s — run producer.js for live telemetry...`);
  await sleep(durationSec * 1000);

  let totalMessages = 0;
  for (const sub of connected) {
    totalMessages += sub.subscriber.getMessageCount();
    await sub.subscriber.disconnect();
  }

  const summary = {
    event: "mqtt_soak_complete",
    connectionsRequested: connections,
    connectionsOk: connected.length,
    connectionsFailed: failed.length,
    durationSec,
    totalMessagesReceived: totalMessages,
    avgMessagesPerSubscriber:
      connected.length > 0
        ? Number((totalMessages / connected.length).toFixed(2))
        : 0,
    connectLatencyMs: {
      p50: percentile(
        connected.map((s) => s.connectedMs),
        50
      ),
      p95: percentile(
        connected.map((s) => s.connectedMs),
        95
      ),
    },
    failures: failed.map((f) => ({ index: f.index, error: f.error })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
