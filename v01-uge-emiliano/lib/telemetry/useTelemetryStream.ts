"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CognitoCredentialsProvider } from "@/lib/telemetry/cognitoCredentialsProvider";
import {
  type ConnectionStatus,
  type TelemetryEvent,
  MATCH_ID,
  TELEMETRY_TOPIC,
  parseTelemetryEvent,
} from "@/lib/telemetry/types";

const MAX_EVENTS = 80;

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

export function useTelemetryStream() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<import("aws-crt/dist.browser/browser/mqtt").MqttClientConnection | null>(null);

  const pushEvent = useCallback((event: TelemetryEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    const configError = getConfigError();
    if (configError) {
      setStatus("error");
      setError(configError);
      return;
    }

    let cancelled = false;

    async function connect() {
      setStatus("connecting");
      setError(null);

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
          if (!cancelled) setStatus("connected");
        });
        connection.on("disconnect", () => {
          if (!cancelled) setStatus("disconnected");
        });
        connection.on("error", (err) => {
          if (!cancelled) {
            setStatus("error");
            setError(err?.message ?? "MQTT connection error");
          }
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
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Failed to connect to IoT"
          );
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      const connection = connectionRef.current;
      connectionRef.current = null;
      connection?.disconnect().catch(() => undefined);
    };
  }, [pushEvent]);

  return {
    events,
    status,
    error,
    matchId: MATCH_ID,
    topic: TELEMETRY_TOPIC,
  };
}
