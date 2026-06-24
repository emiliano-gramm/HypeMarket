"use client";

import { motion } from "framer-motion";
import { Play, Signal } from "lucide-react";

interface LiveStreamPanelProps {
  matchId: string;
  streamEmbedUrl?: string;
}

export function LiveStreamPanel({ matchId, streamEmbedUrl }: LiveStreamPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4 text-brand-strong" />
          <h2 className="text-sm font-semibold tracking-wide text-ink">Live Stream</h2>
          <span className="font-mono text-[11px] text-ink-faint">{matchId}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-1">
          <motion.span
            className="h-2 w-2 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Live</span>
        </div>
      </div>

      <div className="relative aspect-video w-full bg-arena">
        {streamEmbedUrl ? (
          <iframe
            src={streamEmbedUrl}
            title={`Live stream for ${matchId}`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="glow-brand pointer-events-none absolute inset-0 opacity-60" />
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-brand-strong backdrop-blur-sm"
              aria-label="Play stream preview"
            >
              <Play className="h-7 w-7 translate-x-0.5 fill-current" />
            </motion.button>
            <div className="relative px-4 text-center">
              <p className="text-sm font-medium text-zinc-200">Stream preview</p>
              <p className="mt-1 max-w-xs text-pretty text-xs text-zinc-400">
                Set{" "}
                <span className="font-mono text-zinc-300">NEXT_PUBLIC_STREAM_EMBED_URL</span> to
                render a Twitch, YouTube, or Amazon IVS feed here.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
