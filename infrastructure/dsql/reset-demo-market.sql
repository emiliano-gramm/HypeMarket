-- Reset demo HypeMarket to a clean 50/50 baseline (house float on shard 0).
--
-- ⚠️  Do NOT run this file directly with psql after large load tests — Aurora DSQL
-- rejects single-transaction DELETEs that touch too many rows ("transaction row
-- limit exceeded"). Use the batched runner instead:
--
--   ./infrastructure/dsql/reset-demo-market.sh
--   (always uses reset-demo-market.mjs)
--
-- What a full reset clears (demo poll a1000001-0000-4000-8000-000000000001):
--   • all vote_events for the demo market (stakes + legacy poll rows)
--   • k6 load-test viewers, wallets, and wallet_ledger rows (external_id LIKE 'k6%')
--   • demo-viewer-1/2 ledger history; balances restored to 1000 credits
--   • shard counters + poll_totals synced to 50/50 opening pools; market reopened
--
-- The statements below are applied by reset-demo-market.mjs after batched deletes.

-- Reopen market
UPDATE uge.polls
SET market_type = 'binary',
    locks_at = NULL,
    resolved_option_id = NULL,
    resolved_at = NULL,
    status = 'open'
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

-- Zero shards, then re-apply 50-credit house float per outcome on shard 0
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
    total_votes = 0,
    aggregated_at = CURRENT_TIMESTAMP
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

-- Post-reset sanity
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
