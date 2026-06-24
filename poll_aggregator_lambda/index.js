const { DsqlSigner } = require("@aws-sdk/dsql-signer");
const pg = require("pg");

const AGGREGATE_SQL = `
INSERT INTO uge.poll_totals (poll_id, option_id, total_votes, aggregated_at)
SELECT
    vs.poll_id,
    vs.option_id,
    SUM(vs.vote_count)::bigint,
    CURRENT_TIMESTAMP
FROM uge.vote_shards vs
GROUP BY vs.poll_id, vs.option_id
ON CONFLICT (poll_id, option_id)
DO UPDATE SET
    total_votes = EXCLUDED.total_votes,
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
      `SELECT o.option_key, pt.total_votes::bigint AS total_votes, pt.aggregated_at
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
