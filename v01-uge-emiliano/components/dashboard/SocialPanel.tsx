"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageSquare, Radio, Send, Vote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  castVote,
  getViewerVote,
  type PollOptionState,
} from "@/app/actions/polls";
import type { ChatMessage } from "@/lib/telemetry/types";
import { useViewerId } from "@/lib/viewer/useViewerId";

const POLL_REFRESH_MS = 2000;

const MOCK_CHAT: ChatMessage[] = [
  { user: "vortex_gg", text: "Alpha is cracked this map, no contest", color: "#a78bfa" },
  { user: "shroud_fan_01", text: "that Player_3 collateral was insane", color: "#38bdf8" },
  { user: "casual_andy", text: "bravo comeback incoming, calling it now", color: "#fbbf24" },
];

type PollApiResponse =
  | {
      ok: true;
      state: {
        question: string;
        options: PollOptionState[];
        aggregatedAt: string | null;
      };
    }
  | { ok: false; message: string };

function PollSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="h-3 w-40 animate-pulse rounded bg-edge" />
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-edge" />
          <div className="h-10 w-full animate-pulse rounded-md bg-edge/70" />
        </div>
      ))}
    </div>
  );
}

export function SocialPanel() {
  const viewerId = useViewerId();
  const [options, setOptions] = useState<PollOptionState[]>([]);
  const [question, setQuestion] = useState("Who wins Map 3?");
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [chatDraft, setChatDraft] = useState("");

  const refreshTotals = useCallback(async (bypassCache = false) => {
    try {
      const response = await fetch(
        "/api/polls",
        bypassCache ? { cache: "no-store" } : undefined
      );
      const result = (await response.json()) as PollApiResponse;

      if (!result.ok) {
        setLoadError(result.message);
        return;
      }

      setQuestion(result.state.question);
      setOptions(result.state.options);
      setLoadError(null);
    } catch {
      setLoadError("Failed to load poll totals");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshViewerVote = useCallback(async () => {
    if (!viewerId) return;
    const result = await getViewerVote(viewerId);
    if (result.ok) {
      setVotedFor(result.optionKey);
    }
  }, [viewerId]);

  useEffect(() => {
    void refreshTotals();
    const interval = setInterval(() => void refreshTotals(), POLL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshTotals]);

  useEffect(() => {
    if (!viewerId) return;
    void refreshViewerVote();
  }, [viewerId, refreshViewerVote]);

  const totalVotes = useMemo(
    () => options.reduce((sum, option) => sum + option.votes, 0),
    [options]
  );

  function handleVote(optionKey: string) {
    if (!viewerId || votedFor || isPending) return;

    setVoteError(null);
    startTransition(async () => {
      const result = await castVote(optionKey, viewerId);
      if (!result.ok) {
        setVoteError(result.message);
        if (result.code === "already_voted") {
          await refreshViewerVote();
          await refreshTotals(true);
        }
        return;
      }

      setVotedFor(optionKey);
      setOptions((prev) =>
        prev.map((option) =>
          option.optionKey === optionKey
            ? { ...option, votes: option.votes + 1 }
            : option
        )
      );

      // Bypass CDN cache briefly while the aggregator catches up.
      await refreshTotals(true);
    });
  }

  const disabled = Boolean(votedFor) || isLoading || isPending;

  return (
    <aside className="flex h-full flex-col gap-4">
      {/* Poll */}
      <section className="rounded-xl border border-edge bg-panel">
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
          <Vote className="h-4 w-4 text-brand-strong" />
          <h2 className="text-sm font-semibold tracking-wide text-ink">Match Poll</h2>
          <span className="ml-auto flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-2 py-1 font-mono text-[10px] font-semibold text-brand-strong">
            <Radio className="h-3 w-3" />
            LIVE
          </span>
        </div>

        <div className="p-4">
          <p className="mb-4 text-pretty text-sm font-medium text-ink-muted">{question}</p>

          {voteError && <p className="mb-2 text-xs text-amber-400">{voteError}</p>}
          {loadError && <p className="mb-2 text-xs text-red-400">{loadError}</p>}

          {isLoading ? (
            <PollSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              {options.map((o) => {
                const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                const selected = votedFor === o.optionKey;
                return (
                  <button
                    key={o.optionKey}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleVote(o.optionKey)}
                    className={`group relative w-full overflow-hidden rounded-md border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-brand/60 bg-brand/10"
                        : "border-edge bg-panel-2 hover:border-brand/40"
                    } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {/* animated fill bar — width tracks the live vote share */}
                    <motion.span
                      className={`absolute inset-y-0 left-0 ${selected ? "bg-brand/25" : "bg-ink/10"}`}
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {selected && <Check className="h-3.5 w-3.5 text-brand-strong" />}
                        {o.label}
                      </span>
                      <motion.span
                        key={`${o.optionKey}-${pct}`}
                        initial={{ scale: 1.25, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="font-mono text-xs font-bold tabular-nums text-ink"
                      >
                        {pct}% · {o.votes}
                      </motion.span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-ink-faint">
                {votedFor ? "thanks for voting — live tally" : "cast your vote — one per viewer"}
              </p>
              <p className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={totalVotes}
                    initial={{ y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 6, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    {totalVotes.toLocaleString()}
                  </motion.span>
                </AnimatePresence>
                votes
              </p>
            </div>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            Writes hit sharded counters; a Lambda refreshes{" "}
            <code className="text-ink-muted">poll_totals</code>, read from the
            edge-cached <code className="text-ink-muted">/api/polls</code> route every{" "}
            {POLL_REFRESH_MS / 1000}s.
          </p>
        </div>
      </section>

      {/* Chat (preview) */}
      <section className="flex min-h-[260px] flex-1 flex-col rounded-xl border border-edge bg-panel">
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
          <MessageSquare className="h-4 w-4 text-brand-strong" />
          <h2 className="text-sm font-semibold tracking-wide text-ink">Viewer Chat</h2>
          <span className="ml-auto font-mono text-[10px] text-ink-faint">preview</span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {MOCK_CHAT.map((m, i) => (
            <div key={i} className="text-sm leading-relaxed">
              <span className="font-semibold" style={{ color: m.color }}>
                {m.user}
              </span>
              <span className="text-ink-faint">: </span>
              <span className="text-ink-muted">{m.text}</span>
            </div>
          ))}
          <p className="text-xs italic text-ink-faint">Real chat wiring comes next.</p>
        </div>

        <form
          className="flex items-center gap-2 border-t border-edge p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setChatDraft("");
          }}
        >
          <input
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder="Say something… (preview)"
            className="min-w-0 flex-1 rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none"
          />
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/20 text-brand-strong transition-colors hover:bg-brand/30"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </aside>
  );
}
