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
  | "reconnecting"
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

export interface ChatMessage {
  user: string;
  text: string;
  color: string;
}

const ACTION_STYLES: Record<
  TelemetryAction,
  { badge: string; dot: string; label: string }
> = {
  Kill: { badge: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-500", label: "Kill" },
  Assist: { badge: "bg-sky-500/15 text-sky-400 border-sky-500/30", dot: "bg-sky-500", label: "Assist" },
  Objective: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400", label: "Objective" },
  Movement: { badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400", label: "Move" },
};

export function actionStyle(action: TelemetryAction) {
  return ACTION_STYLES[action];
}

const PLAYER_COLORS = [
  "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#f472b6",
  "#f87171", "#60a5fa", "#2dd4bf", "#facc15", "#c084fc",
];

export function playerColor(playerId: string) {
  const n = Number.parseInt(playerId.replace(/\D/g, ""), 10) || 0;
  return PLAYER_COLORS[(n - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}
