#!/usr/bin/env node
/**
 * Batched reset for demo HypeMarket on Aurora DSQL (IAM admin auth).
 *
 * Clears load-test pollution (k6 viewers/wallets/ledger + demo market stakes)
 * and restores the 50/50 opening baseline. Uses small DELETE batches to stay
 * under DSQL per-transaction row limits.
 *
 * Usage: DSQL_HOST=xxx.dsql.us-east-2.on.aws node reset-demo-market.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const region = process.env.AWS_REGION ?? "us-east-2";
const host = process.env.DSQL_HOST;

const DEMO_POLL_ID = "a1000001-0000-4000-8000-000000000001";
const DEMO_VIEWERS = ["demo-viewer-1", "demo-viewer-2"];
const INITIAL_BALANCE = 1000;
/** Stay well under Aurora DSQL per-transaction row limits after load tests. */
const BATCH_SIZE = Number(process.env.RESET_BATCH_SIZE ?? "400");

if (!host) {
  console.error("Set DSQL_HOST to your cluster endpoint.");
  process.exit(1);
}

function stripLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function splitStatements(sql) {
  return stripLineComments(sql)
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

async function batchDeleteBySubquery(client, label, deleteSql, params) {
  let total = 0;
  for (;;) {
    const result = await client.query(deleteSql, params);
    const n = result.rowCount ?? 0;
    if (n === 0) break;
    total += n;
    process.stdout.write(`  • ${label}: deleted ${n} (running total ${total})\n`);
  }
  return total;
}

async function countRows(client, sql, params = []) {
  const result = await client.query(sql, params);
  return Number(result.rows[0]?.count ?? 0);
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

try {
  await client.connect();

  console.log(`Reset demo market (batch size ${BATCH_SIZE})...`);

  const stakeRows = await countRows(
    client,
    `SELECT count(*)::bigint AS count FROM uge.vote_events WHERE poll_id = $1`,
    [DEMO_POLL_ID]
  );
  const k6LedgerRows = await countRows(
    client,
    `SELECT count(*)::bigint AS count FROM uge.wallet_ledger WHERE external_id LIKE 'k6%'`
  );
  const k6WalletRows = await countRows(
    client,
    `SELECT count(*)::bigint AS count FROM uge.viewer_wallets WHERE external_id LIKE 'k6%'`
  );
  const k6ViewerRows = await countRows(
    client,
    `SELECT count(*)::bigint AS count FROM uge.viewers WHERE external_id LIKE 'k6%'`
  );

  console.log(
    `  Found: ${stakeRows} demo vote_events, ${k6LedgerRows} k6 ledger rows, ${k6WalletRows} k6 wallets, ${k6ViewerRows} k6 viewers`
  );

  console.log("Clearing k6 wallet ledger (batched)...");
  await batchDeleteBySubquery(
    client,
    "wallet_ledger k6%",
    `DELETE FROM uge.wallet_ledger
     WHERE ledger_id IN (
       SELECT ledger_id FROM uge.wallet_ledger
       WHERE external_id LIKE 'k6%'
       LIMIT $1
     )`,
    [BATCH_SIZE]
  );

  console.log("Clearing demo viewer ledger (full reset)...");
  await client.query(
    `DELETE FROM uge.wallet_ledger WHERE external_id = ANY($1::varchar[])`,
    [DEMO_VIEWERS]
  );

  console.log("Clearing demo market vote_events (batched)...");
  await batchDeleteBySubquery(
    client,
    "vote_events demo poll",
    `DELETE FROM uge.vote_events
     WHERE event_id IN (
       SELECT event_id FROM uge.vote_events
       WHERE poll_id = $1
       LIMIT $2
     )`,
    [DEMO_POLL_ID, BATCH_SIZE]
  );

  console.log("Removing k6 wallets (batched)...");
  await batchDeleteBySubquery(
    client,
    "viewer_wallets k6%",
    `DELETE FROM uge.viewer_wallets
     WHERE external_id IN (
       SELECT external_id FROM uge.viewer_wallets
       WHERE external_id LIKE 'k6%'
       LIMIT $1
     )`,
    [BATCH_SIZE]
  );

  console.log("Removing k6 viewers (batched)...");
  await batchDeleteBySubquery(
    client,
    "viewers k6%",
    `DELETE FROM uge.viewers
     WHERE external_id IN (
       SELECT external_id FROM uge.viewers
       WHERE external_id LIKE 'k6%'
       LIMIT $1
     )`,
    [BATCH_SIZE]
  );

  console.log("Restoring demo viewer wallets...");
  for (const externalId of DEMO_VIEWERS) {
    await client.query(
      `INSERT INTO uge.viewers (external_id)
       VALUES ($1)
       ON CONFLICT (external_id) DO NOTHING`,
      [externalId]
    );
    await client.query(
      `INSERT INTO uge.viewer_wallets (external_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (external_id) DO UPDATE
       SET balance = EXCLUDED.balance,
           updated_at = CURRENT_TIMESTAMP`,
      [externalId, INITIAL_BALANCE]
    );
    await client.query(
      `INSERT INTO uge.wallet_ledger (external_id, txn_type, amount, balance_after)
       VALUES ($1, 'grant', $2, $2)`,
      [externalId, INITIAL_BALANCE]
    );
  }

  const sql = readFileSync(join(__dirname, "reset-demo-market.sql"), "utf8");
  const statements = splitStatements(sql);
  console.log(`Applying market baseline (${statements.length} statements)...`);

  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, " ").slice(0, 72);
    process.stdout.write(`  • ${preview}...\n`);
    const result = await client.query(statement);
    if (result.rows?.length) {
      console.table(result.rows);
    }
  }

  console.log("\nDemo market reset complete — pools should be team-a 50 / team-b 50.");
} catch (err) {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
