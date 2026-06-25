const { DsqlSigner } = require("@aws-sdk/dsql-signer");
const pg = require("pg");

// Materializes both the poll totals (total_votes) and the HypeMarket pool
// (staked_total / backer_count) from the shard rows in one pass. staked_amount
// is added in Phase 0 (nullable) so COALESCE keeps legacy poll shards at 0.
const AGGREGATE_SQL = `
INSERT INTO uge.poll_totals
    (poll_id, option_id, total_votes, staked_total, backer_count, aggregated_at)
SELECT
    vs.poll_id,
    vs.option_id,
    SUM(vs.vote_count)::bigint,
    SUM(COALESCE(vs.staked_amount, 0))::bigint,
    SUM(vs.vote_count)::bigint,
    CURRENT_TIMESTAMP
FROM uge.vote_shards vs
GROUP BY vs.poll_id, vs.option_id
ON CONFLICT (poll_id, option_id)
DO UPDATE SET
    total_votes = EXCLUDED.total_votes,
    staked_total = EXCLUDED.staked_total,
    backer_count = EXCLUDED.backer_count,
    aggregated_at = EXCLUDED.aggregated_at
`;

async function withDsqlClient(fn) {
  const host = process.env.DSQL_HOST;
  const region = process.env.AWS_REGION ?? "us-east-2";

  if (!host) {
    throw new Error("DSQL_HOST is not configured");
  }

  const signer = new DsqlSigner({ hostname: host, region });
  const password = await signer.getDbConnectAdminAuthToken();

  const client = new pg.Client({
    host,
    user: "admin",
    password,
    database: "postgres",
    port: 5432,
    ssl: { rejectUnauthorized: true },
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

exports.handler = async () => {
  const result = await withDsqlClient(async (client) => {
    const update = await client.query(AGGREGATE_SQL);
    const totals = await client.query(
      `SELECT o.option_key,
              pt.total_votes::bigint AS total_votes,
              COALESCE(pt.staked_total, 0)::bigint AS staked_total,
              COALESCE(pt.backer_count, 0)::bigint AS backer_count,
              pt.aggregated_at
       FROM uge.poll_totals pt
       JOIN uge.poll_options o ON o.poll_id = pt.poll_id AND o.option_id = pt.option_id
       ORDER BY o.sort_order`
    );
    return { rowsUpdated: update.rowCount, totals: totals.rows };
  });

  console.log(
    JSON.stringify({
      message: "poll_totals refreshed",
      rowsUpdated: result.rowsUpdated,
      totals: result.totals,
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      rowsUpdated: result.rowsUpdated,
      totals: result.totals,
    }),
  };
};
