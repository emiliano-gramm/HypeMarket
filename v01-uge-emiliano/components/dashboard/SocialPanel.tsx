"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  Vote,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  castVote,
  getViewerVote,
  type PollOptionState,
} from "@/app/actions/polls";
import type { ChatMessage } from "@/lib/telemetry/types";
import { useViewerId } from "@/lib/viewer/useViewerId";

const POLL_REFRESH_MS = 2000;
const SYNCED_BANNER_MS = 2500;
const VOTE_TIMEOUT_MS = 20_000;
/** Keep bypassing CDN cache briefly after a vote so stale edge responses cannot regress totals. */
const POST_VOTE_CACHE_BYPASS_MS = 30_000;

type SyncStatus = "idle" | "syncing" | "synced" | "error";

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

function mergePollOptions(
  serverOptions: PollOptionState[],
  floors: Record<string, number>,
  currentOptions: PollOptionState[]
): PollOptionState[] {
  const currentByKey = new Map(
    currentOptions.map((option) => [option.optionKey, option.votes])
  );

  return serverOptions.map((option) => ({
    ...option,
    // Never regress displayed counts — poll totals only go up in this UI.
    votes: Math.max(
      option.votes,
      floors[option.optionKey] ?? 0,
      currentByKey.get(option.optionKey) ?? 0
    ),
  }));
}

function clearConfirmedFloors(
  floors: Record<string, number>,
  serverOptions: PollOptionState[]
): Record<string, number> {
  const next = { ...floors };
  for (const [optionKey, floor] of Object.entries(floors)) {
    const serverOption = serverOptions.find((o) => o.optionKey === optionKey);
    // Only drop the floor once the server (not our merge) reports the count.
    if (serverOption && serverOption.votes >= floor) {
      delete next[optionKey];
    }
  }
  return next;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Vote request timed out")),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

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

function PollOptionButton({
  option,
  pct,
  selected,
  disabled,
  syncing,
  bumpToken,
  onVote,
}: {
  option: PollOptionState;
  pct: number;
  selected: boolean;
  disabled: boolean;
  syncing: boolean;
  bumpToken: number;
  onVote: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onVote}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={`group relative w-full overflow-hidden rounded-md border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-brand/60 bg-brand/10"
          : "border-edge bg-panel-2 hover:border-brand/40"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      {selected && syncing && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-brand/50"
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.span
        className={`absolute inset-y-0 left-0 ${selected ? "bg-brand/25" : "bg-ink/10"}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: syncing ? 0.35 : 0.65, ease: "easeOut" }}
      />
      <span className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <AnimatePresence mode="popLayout" initial={false}>
            {selected && (
              <motion.span
                key="check"
                initial={{ scale: 0, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
              >
                <Check className="h-3.5 w-3.5 text-brand-strong" />
              </motion.span>
            )}
          </AnimatePresence>
          {option.label}
        </span>
        <motion.span
          key={bumpToken > 0 ? `${option.optionKey}-bump-${bumpToken}` : option.optionKey}
          initial={bumpToken > 0 ? { scale: 1.3, y: -2, opacity: 0.5 } : false}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="font-mono text-xs font-bold tabular-nums text-ink"
        >
          {pct}% · {option.votes.toLocaleString()}
        </motion.span>
      </span>
    </motion.button>
  );
}

function SyncBanner({ status, message }: { status: SyncStatus; message: string | null }) {
  if (status === "idle" && !message) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(status === "syncing" || status === "synced" || message) && (
        <motion.div
          key={status === "error" ? "error" : status}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-3 overflow-hidden"
        >
          {status === "syncing" && (
            <p className="flex items-center gap-1.5 text-xs text-brand-strong">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing vote to sharded DSQL counters…
            </p>
          )}
          {status === "synced" && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              Vote recorded — tally updates globally via edge cache
            </p>
          )}
          {status === "error" && message && (
            <p className="text-xs text-amber-400">{message}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SocialPanel() {
  const viewerId = useViewerId();
  const [options, setOptions] = useState<PollOptionState[]>([]);
  const [question, setQuestion] = useState("Who wins Map 3?");
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [chatDraft, setChatDraft] = useState("");

  const optimisticFloorsRef = useRef<Record<string, number>>({});
  const postVoteBypassUntilRef = useRef(0);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [voteBumpToken, setVoteBumpToken] = useState(0);

  const applyServerOptions = useCallback((serverOptions: PollOptionState[]) => {
    setOptions((current) => {
      const merged = mergePollOptions(
        serverOptions,
        optimisticFloorsRef.current,
        current
      );
      optimisticFloorsRef.current = clearConfirmedFloors(
        optimisticFloorsRef.current,
        serverOptions
      );
      return merged;
    });
  }, []);

  const refreshTotals = useCallback(
    async (bypassCache = false) => {
      const hasPendingFloors =
        Object.keys(optimisticFloorsRef.current).length > 0;
      const inPostVoteWindow = Date.now() < postVoteBypassUntilRef.current;
      const useFreshFetch = bypassCache || hasPendingFloors || inPostVoteWindow;

      try {
        const response = await fetch(
          "/api/polls",
          useFreshFetch ? { cache: "no-store" } : undefined
        );
        const result = (await response.json()) as PollApiResponse;

        if (!result.ok) {
          setLoadError(result.message);
          return;
        }

        setQuestion(result.state.question);
        applyServerOptions(result.state.options);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load poll totals");
      } finally {
        setIsLoading(false);
      }
    },
    [applyServerOptions]
  );

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

  useEffect(() => {
    return () => {
      if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    };
  }, []);

  const totalVotes = useMemo(
    () => options.reduce((sum, option) => sum + option.votes, 0),
    [options]
  );

  const markSynced = useCallback(() => {
    setSyncStatus("synced");
    if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    syncedTimerRef.current = setTimeout(() => {
      setSyncStatus("idle");
    }, SYNCED_BANNER_MS);
  }, []);

  async function handleVote(optionKey: string) {
    if (!viewerId || votedFor || syncStatus === "syncing") return;

    const snapshot = {
      options: options.map((o) => ({ ...o })),
      votedFor,
    };

    const priorVotes =
      options.find((o) => o.optionKey === optionKey)?.votes ?? 0;
    const optimisticFloor = priorVotes + 1;

    optimisticFloorsRef.current[optionKey] = optimisticFloor;
    setVoteError(null);
    setVotedFor(optionKey);
    setSyncStatus("syncing");
    setVoteBumpToken((n) => n + 1);
    setOptions((prev) =>
      prev.map((option) =>
        option.optionKey === optionKey
          ? { ...option, votes: optimisticFloor }
          : option
      )
    );

    try {
      const result = await withTimeout(
        castVote(optionKey, viewerId),
        VOTE_TIMEOUT_MS
      );

      if (!result.ok) {
        if (result.code === "already_voted") {
          delete optimisticFloorsRef.current[optionKey];
          setVoteError(result.message);
          setSyncStatus("error");
          await refreshViewerVote();
          await refreshTotals(true);
          return;
        }

        delete optimisticFloorsRef.current[optionKey];
        postVoteBypassUntilRef.current = 0;
        setOptions(snapshot.options);
        setVotedFor(snapshot.votedFor);
        setVoteError(result.message);
        setSyncStatus("error");
        return;
      }

      await refreshTotals(true);
      postVoteBypassUntilRef.current = Date.now() + POST_VOTE_CACHE_BYPASS_MS;
      markSynced();
    } catch (err) {
      delete optimisticFloorsRef.current[optionKey];
      postVoteBypassUntilRef.current = 0;
      setOptions(snapshot.options);
      setVotedFor(snapshot.votedFor);
      setVoteError(
        err instanceof Error && err.message === "Vote request timed out"
          ? "Vote timed out — check your connection and try again."
          : "Network error — vote not saved. Try again."
      );
      setSyncStatus("error");
    }
  }

  const pollLocked = Boolean(votedFor) || isLoading || syncStatus === "syncing";

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

          <SyncBanner
            status={syncStatus}
            message={syncStatus === "error" ? voteError : null}
          />
          {loadError && syncStatus !== "error" && (
            <p className="mb-2 text-xs text-red-400">{loadError}</p>
          )}

          {isLoading ? (
            <PollSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              {options.map((o) => {
                const pct =
                  totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                const selected = votedFor === o.optionKey;
                return (
                  <PollOptionButton
                    key={o.optionKey}
                    option={o}
                    pct={pct}
                    selected={selected}
                    disabled={pollLocked}
                    syncing={selected && syncStatus === "syncing"}
                    bumpToken={selected ? voteBumpToken : 0}
                    onVote={() => void handleVote(o.optionKey)}
                  />
                );
              })}
            </div>
          )}

          {!isLoading && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-ink-faint">
                {syncStatus === "syncing"
                  ? "optimistic UI — DSQL write in flight"
                  : votedFor
                    ? "thanks for voting — live tally"
                    : "cast your vote — one per viewer"}
              </p>
              <p className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                <span className="inline-block tabular-nums">
                  {totalVotes.toLocaleString()}
                </span>
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
