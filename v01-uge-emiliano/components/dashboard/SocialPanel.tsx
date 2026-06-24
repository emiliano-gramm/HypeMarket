"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  castVote,
  getViewerVote,
  type PollOptionState,
} from "@/app/actions/polls";

import { useViewerId } from "@/lib/viewer/useViewerId";

const POLL_REFRESH_MS = 2000;

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

export function SocialPanel() {
  const viewerId = useViewerId();
  const [poll, setPoll] = useState<PollOptionState[]>([]);
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
      setPoll(result.state.options);
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
    () => poll.reduce((sum, option) => sum + option.votes, 0),
    [poll]
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
      setPoll((prev) =>
        prev.map((option) =>
          option.optionKey === optionKey
            ? { ...option, votes: option.votes + 1 }
            : option
        )
      );

      // Bypass CDN cache briefly while aggregator catches up.
      await refreshTotals(true);
    });
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Live Engagement
        </p>
        <h2 className="text-sm font-semibold text-zinc-100">Social Sidecar</h2>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Match Poll
            </h3>
            <span className="text-[10px] text-zinc-500">poll_totals · edge cache</span>
          </div>
          <p className="mb-3 text-sm text-zinc-300">{question}</p>

          {isLoading && (
            <p className="text-xs text-zinc-500">Loading poll totals…</p>
          )}
          {loadError && (
            <p className="mb-2 text-xs text-red-400">{loadError}</p>
          )}
          {voteError && (
            <p className="mb-2 text-xs text-amber-400">{voteError}</p>
          )}

          <div className="space-y-2">
            {poll.map((option) => {
              const pct = totalVotes
                ? Math.round((option.votes / totalVotes) * 100)
                : 0;
              const selected = votedFor === option.optionKey;

              return (
                <button
                  key={option.optionKey}
                  type="button"
                  disabled={Boolean(votedFor) || isLoading || isPending}
                  onClick={() => handleVote(option.optionKey)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-violet-500/50 bg-violet-500/10"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 disabled:hover:border-zinc-800"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-200">{option.label}</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {pct}% · {option.votes}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Writes hit sharded counters; a Lambda refreshes{" "}
            <code className="text-zinc-400">poll_totals</code> every minute. This
            panel polls the edge-cached <code className="text-zinc-400">/api/polls</code>{" "}
            route every {POLL_REFRESH_MS / 1000}s.
          </p>
        </section>

        <section className="flex min-h-[160px] flex-1 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Viewer Chat
            </h3>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs text-zinc-500">
            <p>
              <span className="text-sky-300">NeoFan42:</span> insane flank!
            </p>
            <p>
              <span className="text-emerald-300">StratCaster:</span> objective
              trade was clean
            </p>
            <p>
              <span className="text-amber-300">ClutchKing:</span> watch mid push
            </p>
            <p className="italic text-zinc-600">Real chat wiring comes next.</p>
          </div>
          <form
            className="border-t border-zinc-800 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              setChatDraft("");
            }}
          >
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Say something… (preview)"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </form>
        </section>
      </div>
    </aside>
  );
}
