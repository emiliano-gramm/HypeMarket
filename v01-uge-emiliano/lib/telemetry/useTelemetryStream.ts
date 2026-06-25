"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CognitoCredentialsProvider } from "@/lib/telemetry/cognitoCredentialsProvider";
import {
  type ConnectionStatus,
  type TelemetryEvent,
  MATCH_ID,
  TELEMETRY_TOPIC,
  eventTimestamp,
  parseTelemetryEvent,
} from "@/lib/telemetry/types";

const MAX_EVENTS = 80;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const RECONNECT_MULTIPLIER = 2;

type MqttConnection = import("aws-crt/dist.browser/browser/mqtt").MqttClientConnection;

function normalizePayload(payload: string | Uint8Array | ArrayBuffer): string | Uint8Array {
  if (typeof payload === "string") return payload;
  if (payload instanceof Uint8Array) return payload;
  return new Uint8Array(payload);
}

function getConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_AWS_IOT_ENDPOINT) {
    return "Missing NEXT_PUBLIC_AWS_IOT_ENDPOINT";
  }
  if (!process.env.NEXT_PUBLIC_AWS_REGION) {
    return "Missing NEXT_PUBLIC_AWS_REGION";
  }
  if (!process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID) {
    return "Missing NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID";
  }
  return null;
}

function reconnectDelayMs(attempt: number): number {
  const base = INITIAL_RECONNECT_MS * RECONNECT_MULTIPLIER ** attempt;
  const capped = Math.min(base, MAX_RECONNECT_MS);
  const jitter = Math.floor(Math.random() * capped * 0.2);
  return capped + jitter;
}

function mergeTelemetryEvents(
  primary: TelemetryEvent[],
  secondary: TelemetryEvent[]
): TelemetryEvent[] {
  const bySk = new Map<string, TelemetryEvent>();
  for (const event of [...primary, ...secondary]) {
    const existing = bySk.get(event.SK);
    if (!existing || eventTimestamp(event) >= eventTimestamp(existing)) {
      bySk.set(event.SK, event);
    }
  }
  return Array.from(bySk.values())
    .sort((a, b) => eventTimestamp(b) - eventTimestamp(a))
    .slice(0, MAX_EVENTS);
}

export function useTelemetryStream() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const connectionRef = useRef<MqttConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectPendingRef = useRef(false);

  const pushEvent = useCallback((event: TelemetryEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev.filter((row) => row.SK !== event.SK)];
      return next.slice(0, MAX_EVENTS);
    });
  }, []);

  useEffect(() => {
    const configError = getConfigError();
    if (configError) {
      setStatus("error");
      setError(configError);
      return;
    }

    let cancelled = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    async function teardownConnection() {
      const connection = connectionRef.current;
      connectionRef.current = null;
      if (!connection) return;
      try {
        await connection.disconnect();
      } catch {
        // ignore disconnect errors during teardown
      }
    }

    function scheduleReconnect(reason: string) {
      if (cancelled || reconnectPendingRef.current) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("disconnected");
        setError("Browser offline — will reconnect when online");
        void teardownConnection();
        return;
      }

      reconnectPendingRef.current = true;

      void teardownConnection().then(() => {
        if (cancelled) return;

        const attempt = reconnectAttemptRef.current;
        const delay = reconnectDelayMs(attempt);
        reconnectAttemptRef.current = attempt + 1;
        setReconnectAttempt(attempt + 1);
        setStatus("reconnecting");
        setError(reason);

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          reconnectPendingRef.current = false;
          if (!cancelled) void connect();
        }, delay);
      });
    }

    async function hydrateEvents() {
      try {
        const response = await fetch(`/api/telemetry?limit=${MAX_EVENTS}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as {
          ok: boolean;
          events?: TelemetryEvent[];
        };

        if (data.ok && Array.isArray(data.events) && data.events.length > 0) {
          setEvents((prev) => mergeTelemetryEvents(data.events!, prev));
        }
      } catch {
        // Best-effort catch-up from DynamoDB; live MQTT continues if this fails.
      }
    }

    async function connect() {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("disconnected");
        setError("Browser offline — will reconnect when online");
        return;
      }

      const isRetry = reconnectAttemptRef.current > 0;
      setStatus(isRetry ? "reconnecting" : "connecting");
      if (!isRetry) setError(null);

      try {
        const { mqtt, iot } = await import("aws-iot-device-sdk-v2/dist/browser");
        const region = process.env.NEXT_PUBLIC_AWS_REGION!;
        const identityPoolId = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!;

        const credentialsProvider = new CognitoCredentialsProvider(
          region,
          identityPoolId
        );
        await credentialsProvider.refreshCredentials();

        const config = iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
          .with_endpoint(process.env.NEXT_PUBLIC_AWS_IOT_ENDPOINT!)
          .with_client_id(`web-${crypto.randomUUID()}`)
          .with_clean_session(true)
          .with_keep_alive_seconds(30)
          .with_credential_provider(credentialsProvider)
          .build();

        const client = new mqtt.MqttClient();
        const connection = client.new_connection(config);
        connectionRef.current = connection;

        connection.on("connect", () => {
          if (cancelled) return;
          reconnectAttemptRef.current = 0;
          setReconnectAttempt(0);
          setStatus("connected");
          setError(null);
        });

        connection.on("disconnect", () => {
          if (cancelled) return;
          scheduleReconnect("Connection lost — reconnecting…");
        });

        connection.on("error", (err) => {
          if (cancelled) return;
          const message = err?.message ?? "MQTT connection error";
          scheduleReconnect(message);
        });

        await connection.connect();
        if (cancelled) return;

        await connection.subscribe(
          TELEMETRY_TOPIC,
          mqtt.QoS.AtLeastOnce,
          (_topic, payload) => {
            const event = parseTelemetryEvent(normalizePayload(payload));
            if (event) pushEvent(event);
          }
        );

        if (!cancelled) {
          await hydrateEvents();
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to connect to IoT";
        scheduleReconnect(message);
      }
    }

    function handleBrowserOffline() {
      if (cancelled) return;
      clearReconnectTimer();
      reconnectPendingRef.current = false;
      setStatus("disconnected");
      setError("Browser offline — will reconnect when online");
      void teardownConnection();
    }

    function handleBrowserOnline() {
      if (cancelled) return;
      clearReconnectTimer();
      reconnectPendingRef.current = false;
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setError(null);
      void connect();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("offline", handleBrowserOffline);
      window.addEventListener("online", handleBrowserOnline);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleBrowserOffline();
    } else {
      void connect();
    }

    return () => {
      cancelled = true;
      reconnectPendingRef.current = false;
      clearReconnectTimer();
      if (typeof window !== "undefined") {
        window.removeEventListener("offline", handleBrowserOffline);
        window.removeEventListener("online", handleBrowserOnline);
      }
      void teardownConnection();
    };
  }, [pushEvent]);

  return {
    events,
    status,
    error,
    reconnectAttempt,
    matchId: MATCH_ID,
    topic: TELEMETRY_TOPIC,
  };
}
