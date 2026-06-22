import type { TelemetryAction, TelemetryEvent } from "@/lib/telemetry/types";
import { eventTimestamp } from "@/lib/telemetry/types";

const ACTION_STYLES: Record<
  TelemetryAction,
  { badge: string; dot: string }
> = {
  Kill: {
    badge: "border-red-500/40 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
  Assist: {
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },
  Objective: {
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  Movement: {
    badge: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    dot: "bg-zinc-400",
  },
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TelemetryFeedProps {
  events: TelemetryEvent[];
}

export function TelemetryFeed({ events }: TelemetryFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-4 text-center">
        <p className="text-sm text-zinc-500">
          Waiting for telemetry… Run{" "}
          <code className="text-zinc-300">node producer.js</code> to start the
          feed.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
      {events.map((event) => {
        const style = ACTION_STYLES[event.Action];
        const ts = eventTimestamp(event);

        return (
          <li
            key={event.SK}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2"
          >
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-200">
                  {event.PlayerId}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
                >
                  {event.Action}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                ({event.CoordinateX.toFixed(1)}, {event.CoordinateY.toFixed(1)})
              </p>
            </div>
            <time className="font-mono text-[10px] text-zinc-500">
              {formatTime(ts)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
