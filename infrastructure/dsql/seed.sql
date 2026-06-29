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

-- ===========================================================================
-- HypeMarket extension seed — turns the demo poll into a prediction market
-- Safe to re-run. See .project_utils/updated_idea.md.
-- ===========================================================================

-- Promote the demo poll to a binary market. Staking stays open until an admin
-- locks or resolves (no auto-expiry — testers may return on different days).
UPDATE uge.polls
SET market_type = 'binary',
    locks_at    = NULL,
    resolved_option_id = NULL,
    resolved_at = NULL,
    status      = 'open'
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

-- Backfill staked_amount to 0 on all shards (column is added nullable in DSQL).
UPDATE uge.vote_shards
SET staked_amount = 0
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
  AND staked_amount IS NULL;

-- Seed a small house float (50 credits/outcome) on shard 0 so implied odds are
-- defined before the first real stake. Shard sum stays the ground truth.
UPDATE uge.vote_shards
SET staked_amount = 50
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid
  AND shard_id = 0;

-- Bootstrap materialized pool totals to match the float (aggregator keeps them
-- in sync afterwards). 50 credits, 0 real backers per outcome.
UPDATE uge.poll_totals
SET staked_total = 50,
    backer_count = 0
WHERE poll_id = 'a1000001-0000-4000-8000-000000000001'::uuid;

-- Demo wallets — 1000 Hype Credits each (play money, non-redeemable)
INSERT INTO uge.viewer_wallets (external_id, balance)
VALUES
    ('demo-viewer-1', 1000),
    ('demo-viewer-2', 1000)
ON CONFLICT (external_id) DO NOTHING;
