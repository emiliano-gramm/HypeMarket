"use client";

import { useMemo, useState } from "react";

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

const INITIAL_POLL: PollOption[] = [
  { id: "team-a", label: "Team Alpha", votes: 1284 },
  { id: "team-b", label: "Team Bravo", votes: 1197 },
];

export function SocialPanel() {
  const [poll, setPoll] = useState(INITIAL_POLL);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");

  const totalVotes = useMemo(
    () => poll.reduce((sum, option) => sum + option.votes, 0),
    [poll]
  );

  function handleVote(optionId: string) {
    if (votedFor) return;
    setVotedFor(optionId);
    setPoll((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? { ...option, votes: option.votes + 1 }
          : option
      )
    );
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
            <span className="text-[10px] text-zinc-500">Local preview</span>
          </div>
          <p className="mb-3 text-sm text-zinc-300">Who wins Map 3?</p>
          <div className="space-y-2">
            {poll.map((option) => {
              const pct = totalVotes
                ? Math.round((option.votes / totalVotes) * 100)
                : 0;
              const selected = votedFor === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(votedFor)}
                  onClick={() => handleVote(option.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-violet-500/50 bg-violet-500/10"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 disabled:hover:border-zinc-800"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-200">{option.label}</span>
                    <span className="font-mono text-xs text-zinc-400">{pct}%</span>
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
            Aurora DSQL sharded counters will replace this local state in a later
            step.
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
