-- Reset the demo HypeMarket poll to a clean 50/50 baseline (house float on shard 0).
-- Destructive for poll a1000001-0000-4000-8000-000000000001 only:
--   • clears stake history (vote_events with amount > 0)
--   • zeroes shard counters, re-applies 50-credit float per outcome on shard 0
--   • syncs poll_totals immediately (no need to wait for the aggregator Lambda)
--   • reopens the market (clears lock + resolution)
-- Does NOT reset viewer wallets or social poll votes (amount IS NULL).
-- Safe to re-run.

BEGIN;

UPDATE uge.polls
SET market_type = 'binary',
    locks_at = CURRENT_TIMESTAMP + INTERVAL '6 hours',
    resolved_option_id = NULL,
    resolved_at = NULL,
    status = 'open'
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

DELETE FROM uge.vote_events
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
  AND amount IS NOT NULL
  AND amount > 0;

UPDATE uge.vote_shards
SET staked_amount = 0,
    vote_count = 0
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

UPDATE uge.vote_shards
SET staked_amount = 50
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
  AND shard_id = 0;

UPDATE uge.poll_totals
SET staked_total = 50,
    backer_count = 0,
    aggregated_at = CURRENT_TIMESTAMP
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

COMMIT;

-- Post-reset sanity (printed by reset-demo-market.sh)
SELECT p.status,
       p.locks_at,
       p.resolved_option_id,
       ro.option_key AS winning_option_key
FROM uge.polls p
LEFT JOIN uge.poll_options ro ON ro.option_id = p.resolved_option_id
WHERE p.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

SELECT o.option_key,
       t.staked_total,
       SUM(vs.staked_amount)::bigint AS shard_staked_sum
FROM uge.poll_options o
JOIN uge.poll_totals t ON t.poll_id = o.poll_id AND t.option_id = o.option_id
JOIN uge.vote_shards vs ON vs.poll_id = o.poll_id AND vs.option_id = o.option_id
WHERE o.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
GROUP BY o.option_key, o.sort_order, t.staked_total
ORDER BY o.sort_order;
