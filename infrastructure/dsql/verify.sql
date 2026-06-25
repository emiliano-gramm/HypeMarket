-- Quick sanity checks after schema + seed apply

SELECT 'polls' AS tbl, count(*)::text AS rows FROM uge.polls
UNION ALL
SELECT 'poll_options', count(*)::text FROM uge.poll_options
UNION ALL
SELECT 'vote_shards', count(*)::text FROM uge.vote_shards
UNION ALL
SELECT 'poll_totals', count(*)::text FROM uge.poll_totals
UNION ALL
SELECT 'viewer_wallets', count(*)::text FROM uge.viewer_wallets
UNION ALL
SELECT 'wallet_ledger', count(*)::text FROM uge.wallet_ledger;

-- Materialized totals (step 6 read path)
SELECT p.match_id, p.question, o.option_key, o.label, t.total_votes, t.aggregated_at
FROM uge.polls p
JOIN uge.poll_options o ON o.poll_id = p.poll_id
LEFT JOIN uge.poll_totals t ON t.poll_id = o.poll_id AND t.option_id = o.option_id
WHERE p.match_id = 'M-1001'
ORDER BY o.sort_order;

-- Ground truth from shards (should match poll_totals after aggregator runs)
SELECT o.option_key, SUM(vs.vote_count)::bigint AS shard_sum
FROM uge.poll_options o
JOIN uge.vote_shards vs ON vs.poll_id = o.poll_id AND vs.option_id = o.option_id
WHERE o.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
GROUP BY o.option_key
ORDER BY o.option_key;

-- HypeMarket: market metadata + lock/resolve state
SELECT match_id, question, market_type, status, locks_at, resolved_option_id
FROM uge.polls
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

-- HypeMarket: pool totals + implied odds (decimal) derived from staked share
SELECT o.option_key,
       o.label,
       t.staked_total,
       t.backer_count,
       ROUND(t.staked_total::numeric / NULLIF(SUM(t.staked_total) OVER (), 0), 4) AS implied_prob,
       ROUND(SUM(t.staked_total) OVER ()::numeric / NULLIF(t.staked_total, 0), 4) AS decimal_odds
FROM uge.poll_options o
JOIN uge.poll_totals t ON t.poll_id = o.poll_id AND t.option_id = o.option_id
WHERE o.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
ORDER BY o.sort_order;

-- HypeMarket: shard staked_amount sum should equal market_pools.staked_total
SELECT o.option_key, SUM(vs.staked_amount)::bigint AS shard_staked_sum
FROM uge.poll_options o
JOIN uge.vote_shards vs ON vs.poll_id = o.poll_id AND vs.option_id = o.option_id
WHERE o.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
GROUP BY o.option_key
ORDER BY o.option_key;

-- HypeMarket: demo wallet balances
SELECT external_id, balance, updated_at
FROM uge.viewer_wallets
ORDER BY external_id;
