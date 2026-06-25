-- Aurora DSQL schema for Ultimate Global Entertainment (social / polls)
-- Region: us-east-2 | PostgreSQL 16 compatible
--
-- Sharded counter pattern: concurrent votes UPDATE distinct vote_shards rows
-- (poll_id, option_id, shard_id) instead of a single hot row per option.
-- vote_events enforces one vote per viewer per poll.
-- poll_totals is materialized by the aggregation worker in step 6.

CREATE SCHEMA IF NOT EXISTS uge;

-- ---------------------------------------------------------------------------
-- Viewers (anonymous second-screen users — Cognito identity or client UUID)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.viewers (
    external_id   VARCHAR(128) PRIMARY KEY,
    display_name  VARCHAR(64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Polls (one active poll per match is typical; schema supports many)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.polls (
    poll_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id     VARCHAR(32) NOT NULL,
    question     TEXT NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'open',
    shard_count  SMALLINT NOT NULL DEFAULT 32,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closes_at    TIMESTAMPTZ
);

CREATE INDEX ASYNC IF NOT EXISTS idx_polls_match_id
    ON uge.polls (match_id);

CREATE INDEX ASYNC IF NOT EXISTS idx_polls_match_status
    ON uge.polls (match_id, status);

-- ---------------------------------------------------------------------------
-- Poll options (e.g. Team Alpha vs Team Bravo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.poll_options (
    option_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id     UUID NOT NULL,
    option_key  VARCHAR(64) NOT NULL,
    label       VARCHAR(255) NOT NULL,
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS idx_poll_options_poll_key
    ON uge.poll_options (poll_id, option_key);

CREATE INDEX ASYNC IF NOT EXISTS idx_poll_options_poll_id
    ON uge.poll_options (poll_id);

-- ---------------------------------------------------------------------------
-- Vote shards — core write path for the sharded counter pattern
-- Pre-seed shard_count rows per option; votes increment a random shard.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.vote_shards (
    poll_id     UUID NOT NULL,
    option_id   UUID NOT NULL,
    shard_id    SMALLINT NOT NULL,
    vote_count  BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, option_id, shard_id)
);

-- Covers SUM(vote_count) ... GROUP BY option_id per poll
CREATE INDEX ASYNC IF NOT EXISTS idx_vote_shards_poll_option
    ON uge.vote_shards (poll_id, option_id);

-- ---------------------------------------------------------------------------
-- Vote events — append-only audit log + one-vote-per-viewer enforcement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.vote_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id             UUID NOT NULL,
    option_id           UUID NOT NULL,
    viewer_external_id  VARCHAR(128) NOT NULL,
    shard_id            SMALLINT NOT NULL,
    voted_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS idx_vote_events_one_per_viewer
    ON uge.vote_events (poll_id, viewer_external_id);

CREATE INDEX ASYNC IF NOT EXISTS idx_vote_events_poll_voted_at
    ON uge.vote_events (poll_id, voted_at);

-- ---------------------------------------------------------------------------
-- Materialized totals — updated by background aggregator (step 6), not voters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.poll_totals (
    poll_id       UUID NOT NULL,
    option_id     UUID NOT NULL,
    total_votes   BIGINT NOT NULL DEFAULT 0,
    aggregated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, option_id)
);

CREATE INDEX ASYNC IF NOT EXISTS idx_poll_totals_poll_id
    ON uge.poll_totals (poll_id);

-- ===========================================================================
-- HypeMarket extension — live esports prediction markets (play money)
-- Additive migration: reuses polls/poll_options/vote_shards/vote_events/
-- poll_totals as markets/outcomes/stake_shards/stakes/market_pools, and adds
-- wallets + an append-only ledger. Existing poll code keeps working; new
-- columns carry sane defaults. See .project_utils/updated_idea.md.
-- ===========================================================================

-- NOTE: Aurora DSQL does not support ADD COLUMN with NOT NULL/DEFAULT
-- constraints, so new columns are added bare (nullable). Defaults are applied
-- by seed.sql backfills and by COALESCE(...) in the application/query layer.

-- Markets (reuses uge.polls). A market locks before the outcome is known and
-- is then resolved to a winning outcome for parimutuel settlement.
ALTER TABLE uge.polls ADD COLUMN IF NOT EXISTS market_type        VARCHAR(16);
ALTER TABLE uge.polls ADD COLUMN IF NOT EXISTS locks_at           TIMESTAMPTZ;
ALTER TABLE uge.polls ADD COLUMN IF NOT EXISTS resolved_option_id UUID;
ALTER TABLE uge.polls ADD COLUMN IF NOT EXISTS resolved_at        TIMESTAMPTZ;

-- Stake shards (reuses uge.vote_shards). staked_amount = sum of credits on this
-- shard; vote_count is reused as the per-shard participant counter.
ALTER TABLE uge.vote_shards ADD COLUMN IF NOT EXISTS staked_amount BIGINT;

-- Stakes ledger (reuses uge.vote_events). Append-only; multiple stakes per
-- viewer are now allowed, so the one-vote-per-viewer unique index is dropped.
-- placeStake always writes amount + settled; legacy rows stay NULL and are
-- excluded from settlement via amount > 0 / COALESCE(settled,false).
ALTER TABLE uge.vote_events ADD COLUMN IF NOT EXISTS amount  BIGINT;
ALTER TABLE uge.vote_events ADD COLUMN IF NOT EXISTS payout  BIGINT;
ALTER TABLE uge.vote_events ADD COLUMN IF NOT EXISTS settled BOOLEAN;

DROP INDEX IF EXISTS uge.idx_vote_events_one_per_viewer;

-- Supports settlement scans: winning-outcome stakes that are not yet settled.
CREATE INDEX ASYNC IF NOT EXISTS idx_vote_events_poll_option_settled
    ON uge.vote_events (poll_id, option_id, settled);

-- Market pools (reuses uge.poll_totals). staked_total drives implied odds;
-- backer_count is the number of stakes backing the outcome.
ALTER TABLE uge.poll_totals ADD COLUMN IF NOT EXISTS staked_total BIGINT;
ALTER TABLE uge.poll_totals ADD COLUMN IF NOT EXISTS backer_count BIGINT;

-- ---------------------------------------------------------------------------
-- Viewer wallets — play-money "Hype Credits" balance (low-contention per row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.viewer_wallets (
    external_id  VARCHAR(128) PRIMARY KEY,
    balance      BIGINT NOT NULL DEFAULT 1000,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Wallet ledger — append-only credit transactions (audit + provable balances)
-- txn_type: 'grant' | 'stake' | 'payout'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uge.wallet_ledger (
    ledger_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id    VARCHAR(128) NOT NULL,
    txn_type       VARCHAR(16)  NOT NULL,
    amount         BIGINT       NOT NULL,
    balance_after  BIGINT,
    poll_id        UUID,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ASYNC IF NOT EXISTS idx_wallet_ledger_external
    ON uge.wallet_ledger (external_id, created_at);
