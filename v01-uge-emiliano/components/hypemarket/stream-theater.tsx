import { Maximize2, Volume2 } from 'lucide-react'

interface StreamTheaterProps {
  title: string
  /** Optional viewer count — omitted when there is no real source. */
  viewers?: number
  /** When set, renders a real embed (Twitch / YouTube / Amazon IVS) instead of the faux stage. */
  embedUrl?: string
}

export function StreamTheater({
  title,
  viewers,
  embedUrl,
}: StreamTheaterProps) {
  if (embedUrl) {
    return (
      <div className="group overflow-hidden rounded-xl border border-edge bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_60px_-24px_rgba(0,0,0,0.9)]">
        <div className="relative aspect-video w-full bg-arena">
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          {typeof viewers === 'number' && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-0.5 font-mono text-xs tabular-nums text-ink-muted backdrop-blur-sm">
              {viewers.toLocaleString()} watching
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-edge bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_60px_-24px_rgba(0,0,0,0.9)]">
      {/* edge-to-edge 16:9 stage */}
      <div className="relative aspect-video w-full bg-arena">
        {/* faux stream backdrop */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.5), transparent 45%), radial-gradient(circle at 75% 70%, rgba(249,115,22,0.35), transparent 40%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden
        />

        {/* center play state */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <span className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">
            Live Stream
          </span>
          <span className="font-display text-2xl font-extrabold text-ink/90">
            {title}
          </span>
        </div>

        {typeof viewers === 'number' && (
          <span className="absolute right-3 top-3 rounded-md bg-black/55 px-2 py-0.5 font-mono text-xs tabular-nums text-ink-muted backdrop-blur-sm">
            {viewers.toLocaleString()} watching
          </span>
        )}

        {/* controls reveal on hover only — keeps the stage clean */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-md bg-black/55 p-0.5 text-ink-muted backdrop-blur-sm">
            <button
              type="button"
              aria-label="Volume"
              className="rounded p-1.5 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <Volume2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Fullscreen"
              className="rounded p-1.5 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
