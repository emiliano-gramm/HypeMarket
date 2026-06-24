"use server";

import { withDsqlClient } from "@/lib/dsql/client";
import {
  fetchPublicPollState,
  fetchViewerVoteOptionKey,
  getDemoPollId,
} from "@/lib/polls/queries";
import { triggerPollAggregator } from "@/lib/polls/triggerAggregator";
import type {
  CastVoteResult,
  GetPollStateResult,
  GetViewerVoteResult,
} from "@/lib/polls/types";

export type {
  CastVoteResult,
  GetPollStateResult,
  GetViewerVoteResult,
  PollOptionState,
  PollState,
  PublicPollState,
} from "@/lib/polls/types";

export async function getPollState(
  viewerExternalId?: string
): Promise<GetPollStateResult> {
  try {
    const pollId = getDemoPollId();

    const state = await withDsqlClient(async (client) => {
      const publicState = await fetchPublicPollState(client, pollId);
      let viewerVoteOptionKey: string | null = null;

      if (viewerExternalId) {
        viewerVoteOptionKey = await fetchViewerVoteOptionKey(
          client,
          pollId,
          viewerExternalId
        );
      }

      return { ...publicState, viewerVoteOptionKey };
    });

    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Failed to load poll from DSQL",
    };
  }
}

export async function getViewerVote(
  viewerExternalId: string
): Promise<GetViewerVoteResult> {
  if (!viewerExternalId || viewerExternalId.length > 128) {
    return { ok: false, message: "Invalid viewer id" };
  }

  try {
    const pollId = getDemoPollId();
    const optionKey = await withDsqlClient((client) =>
      fetchViewerVoteOptionKey(client, pollId, viewerExternalId)
    );
    return { ok: true, optionKey };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Failed to load viewer vote",
    };
  }
}

export async function castVote(
  optionKey: string,
  viewerExternalId: string
): Promise<CastVoteResult> {
  if (!viewerExternalId || viewerExternalId.length > 128) {
    return { ok: false, code: "error", message: "Invalid viewer id" };
  }

  const pollId = getDemoPollId();

  try {
    const result = await withDsqlClient(async (client) => {
      const pollResult = await client.query<{
        status: string;
        shard_count: number;
      }>(
        `SELECT status, shard_count
         FROM uge.polls
         WHERE poll_id = $1`,
        [pollId]
      );

      if (pollResult.rows.length === 0 || pollResult.rows[0].status !== "open") {
        return { ok: false, code: "poll_closed", message: "Poll is not open" } as const;
      }

      const shardCount = pollResult.rows[0].shard_count;

      const optionResult = await client.query<{ option_id: string }>(
        `SELECT option_id
         FROM uge.poll_options
         WHERE poll_id = $1 AND option_key = $2`,
        [pollId, optionKey]
      );

      if (optionResult.rows.length === 0) {
        return { ok: false, code: "invalid_option", message: "Unknown option" } as const;
      }

      const optionId = optionResult.rows[0].option_id;
      const shardId = Math.floor(Math.random() * shardCount);

      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO uge.viewers (external_id)
           VALUES ($1)
           ON CONFLICT (external_id) DO NOTHING`,
          [viewerExternalId]
        );

        await client.query(
          `INSERT INTO uge.vote_events (poll_id, option_id, viewer_external_id, shard_id)
           VALUES ($1, $2, $3, $4)`,
          [pollId, optionId, viewerExternalId, shardId]
        );

        const shardUpdate = await client.query(
          `UPDATE uge.vote_shards
           SET vote_count = vote_count + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE poll_id = $1 AND option_id = $2 AND shard_id = $3`,
          [pollId, optionId, shardId]
        );

        if (shardUpdate.rowCount !== 1) {
          throw new Error("Shard counter row missing — re-run seed.sql");
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          err.code === "23505"
        ) {
          return {
            ok: false,
            code: "already_voted",
            message: "You already voted in this poll",
          } as const;
        }
        throw err;
      }

      return { ok: true } as const;
    });

    if (result.ok) {
      triggerPollAggregator();
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : "Vote failed",
    };
  }
}
