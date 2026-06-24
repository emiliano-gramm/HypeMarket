#!/usr/bin/env node
/**
 * Apply schema/seed/verify SQL to Aurora DSQL using IAM admin auth.
 * Usage: DSQL_HOST=xxx.dsql.us-east-2.on.aws node apply-schema.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const region = process.env.AWS_REGION ?? "us-east-2";
const host = process.env.DSQL_HOST;

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

async function runFile(name) {
  const sql = readFileSync(join(__dirname, name), "utf8");
  const statements = splitStatements(sql);
  console.log(`Running ${name} (${statements.length} statements)...`);

  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, " ").slice(0, 72);
    process.stdout.write(`  • ${preview}...\n`);
    await client.query(statement);
  }
}

try {
  await client.connect();
  await runFile("schema.sql");
  await runFile("seed.sql");

  console.log("Running verify.sql...");
  const verify = readFileSync(join(__dirname, "verify.sql"), "utf8");
  for (const statement of splitStatements(verify)) {
    const result = await client.query(statement);
    if (result.rows?.length) {
      console.table(result.rows);
    }
  }

  console.log("\nSchema applied successfully.");
} catch (err) {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
} finally {
  await client.end();
}
