-- Quick sanity checks after schema + seed apply

SELECT 'polls' AS tbl, count(*)::text AS rows FROM uge.polls
UNION ALL
SELECT 'poll_options', count(*)::text FROM uge.poll_options
UNION ALL
SELECT 'vote_shards', count(*)::text FROM uge.vote_shards
UNION ALL
SELECT 'poll_totals', count(*)::text FROM uge.poll_totals;

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
