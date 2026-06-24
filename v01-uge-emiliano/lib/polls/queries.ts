import type pg from "pg";
import type { PublicPollState } from "@/lib/polls/types";

export function getDemoPollId(): string {
  const pollId = process.env.DSQL_DEMO_POLL_ID;
  if (!pollId) {
    throw new Error("DSQL_DEMO_POLL_ID is not configured");
  }
  return pollId;
}

export async function fetchPublicPollState(
  client: pg.Client,
  pollId: string
): Promise<PublicPollState> {
  const pollResult = await client.query<{ question: string }>(
    `SELECT question
     FROM uge.polls
     WHERE poll_id = $1 AND status = 'open'`,
    [pollId]
  );

  if (pollResult.rows.length === 0) {
    throw new Error("Poll not found or closed");
  }

  const optionsResult = await client.query<{
    option_key: string;
    label: string;
    votes: string;
    aggregated_at: Date | null;
  }>(
    `SELECT o.option_key,
            o.label,
            COALESCE(pt.total_votes, 0)::bigint AS votes,
            MAX(pt.aggregated_at) OVER () AS aggregated_at
     FROM uge.poll_options o
     LEFT JOIN uge.poll_totals pt
       ON pt.poll_id = o.poll_id AND pt.option_id = o.option_id
     WHERE o.poll_id = $1
     ORDER BY o.sort_order`,
    [pollId]
  );

  const aggregatedAt = optionsResult.rows[0]?.aggregated_at;

  return {
    question: pollResult.rows[0].question,
    options: optionsResult.rows.map((row) => ({
      optionKey: row.option_key,
      label: row.label,
      votes: Number(row.votes),
    })),
    aggregatedAt: aggregatedAt ? aggregatedAt.toISOString() : null,
  };
}

export async function fetchViewerVoteOptionKey(
  client: pg.Client,
  pollId: string,
  viewerExternalId: string
): Promise<string | null> {
  const voteResult = await client.query<{ option_key: string }>(
    `SELECT o.option_key
     FROM uge.vote_events ve
     JOIN uge.poll_options o ON o.option_id = ve.option_id
     WHERE ve.poll_id = $1 AND ve.viewer_external_id = $2`,
    [pollId, viewerExternalId]
  );
  return voteResult.rows[0]?.option_key ?? null;
}
