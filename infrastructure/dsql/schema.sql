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
