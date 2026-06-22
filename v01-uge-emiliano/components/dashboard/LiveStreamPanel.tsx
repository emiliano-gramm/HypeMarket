"use client";

const STREAM_EMBED_URL = process.env.NEXT_PUBLIC_STREAM_EMBED_URL;

interface LiveStreamPanelProps {
  matchId: string;
}

export function LiveStreamPanel({ matchId }: LiveStreamPanelProps) {
  return (
    <section className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Live Broadcast
          </p>
          <h2 className="text-sm font-semibold text-zinc-100">Match {matchId}</h2>
        </div>
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
          Live
        </span>
      </header>

      <div className="relative flex flex-1 items-center justify-center bg-black">
        {STREAM_EMBED_URL ? (
          <iframe
            src={STREAM_EMBED_URL}
            title={`Live stream for match ${matchId}`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
              <span className="text-xl">▶</span>
            </div>
            <p className="text-sm font-medium text-zinc-200">Stream placeholder</p>
            <p className="text-xs leading-relaxed text-zinc-500">
              Set{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
                NEXT_PUBLIC_STREAM_EMBED_URL
              </code>{" "}
              to your Twitch, YouTube, or Amazon IVS embed URL.
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
          <p className="text-xs text-zinc-400">
            Primary feed · synchronized with telemetry panel
          </p>
        </div>
      </div>
    </section>
  );
}
