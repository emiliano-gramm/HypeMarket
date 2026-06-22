export type TelemetryAction = "Kill" | "Assist" | "Objective" | "Movement";

export interface TelemetryEvent {
  PK: string;
  SK: string;
  PlayerId: string;
  Action: TelemetryAction;
  CoordinateX: number;
  CoordinateY: number;
  ExpiryTimestamp: number;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export const MATCH_ID = process.env.NEXT_PUBLIC_MATCH_ID ?? "M-1001";

export const TELEMETRY_TOPIC = `esports/telemetry/${MATCH_ID}`;

export function parseTelemetryEvent(payload: Uint8Array | string): TelemetryEvent | null {
  try {
    const text =
      typeof payload === "string"
        ? payload
        : new TextDecoder().decode(payload);
    const raw = JSON.parse(text) as TelemetryEvent;
    if (!raw.PK || !raw.PlayerId || !raw.Action) return null;
    return raw;
  } catch {
    return null;
  }
}

export function eventTimestamp(event: TelemetryEvent): number {
  const match = event.SK.match(/^EVENT#(\d+)#/);
  return match ? Number(match[1]) : Date.now();
}
