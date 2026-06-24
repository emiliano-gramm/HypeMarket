export type PollOptionState = {
  optionKey: string;
  label: string;
  votes: number;
};

export type PublicPollState = {
  question: string;
  options: PollOptionState[];
  aggregatedAt: string | null;
};

export type PollState = PublicPollState & {
  viewerVoteOptionKey: string | null;
};

export type GetPollStateResult =
  | { ok: true; state: PollState }
  | { ok: false; message: string };

export type GetViewerVoteResult =
  | { ok: true; optionKey: string | null }
  | { ok: false; message: string };

export type CastVoteResult =
  | { ok: true }
  | {
      ok: false;
      code: "already_voted" | "invalid_option" | "poll_closed" | "error";
      message: string;
    };
