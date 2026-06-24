-- Demo seed: "Who wins Map 3?" for match M-1001 (matches SocialPanel.tsx)
-- Safe to re-run: uses fixed poll_id and skips if poll already exists.

INSERT INTO uge.polls (poll_id, match_id, question, status, shard_count)
VALUES (
    'a1000001-0000-4000-8000-000000000001'::uuid,
    'M-1001',
    'Who wins Map 3?',
    'open',
    32
)
ON CONFLICT (poll_id) DO NOTHING;

INSERT INTO uge.poll_options (option_id, poll_id, option_key, label, sort_order)
VALUES
    (
        'b2000001-0000-4000-8000-000000000001'::uuid,
        'a1000001-0000-4000-8000-000000000001'::uuid,
        'team-a',
        'Team Alpha',
        0
    ),
    (
        'b2000001-0000-4000-8000-000000000002'::uuid,
        'a1000001-0000-4000-8000-000000000001'::uuid,
        'team-b',
        'Team Bravo',
        1
    )
ON CONFLICT (option_id) DO NOTHING;

-- Pre-create 32 counter shards per option (shard_id 0..31)
INSERT INTO uge.vote_shards (poll_id, option_id, shard_id, vote_count)
SELECT
    p.poll_id,
    o.option_id,
    s.shard_id,
    0
FROM uge.polls p
JOIN uge.poll_options o ON o.poll_id = p.poll_id
CROSS JOIN generate_series(0, 31) AS s(shard_id)
WHERE p.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
ON CONFLICT (poll_id, option_id, shard_id) DO NOTHING;

-- Bootstrap materialized totals at zero (aggregator refreshes these in step 6)
INSERT INTO uge.poll_totals (poll_id, option_id, total_votes)
SELECT o.poll_id, o.option_id, 0
FROM uge.poll_options o
WHERE o.poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
ON CONFLICT (poll_id, option_id) DO NOTHING;

-- Optional demo viewers (for local testing before Cognito wiring)
INSERT INTO uge.viewers (external_id, display_name)
VALUES
    ('demo-viewer-1', 'NeoFan42'),
    ('demo-viewer-2', 'StratCaster')
ON CONFLICT (external_id) DO NOTHING;
