#!/usr/bin/env node
/**
 * Delete telemetry events from DynamoDB for a demo match.
 *
 * Clears the MatchTelemetry partition so reconnect/hydrate starts with an
 * empty event feed. Live MQTT messages already in the browser are unaffected
 * until the page is refreshed.
 *
 * Usage:
 *   node clear-telemetry.mjs
 *   node clear-telemetry.mjs --match=M-1001
 *   node clear-telemetry.mjs --dry-run
 *
 * Env:
 *   AWS_REGION            default us-east-2
 *   TELEMETRY_TABLE_NAME  default MatchTelemetry
 *   MATCH_ID              default M-1001 (overridden by --match)
 */
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION ?? "us-east-2";
const tableName = process.env.TELEMETRY_TABLE_NAME ?? "MatchTelemetry";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const matchArg = argv.find((arg) => arg.startsWith("--match="));
const matchId = matchArg?.slice("--match=".length) ?? process.env.MATCH_ID ?? "M-1001";
const pk = `MATCH#${matchId}`;
const WRITE_BATCH = 25;
const MAX_RETRIES = 5;

const client = new DynamoDBClient({ region });

async function queryKeys(exclusiveStartKey) {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": { S: pk } },
      ProjectionExpression: "PK, SK",
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  return {
    keys: (result.Items ?? []).map((item) => ({
      PK: item.PK.S,
      SK: item.SK.S,
    })),
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}

async function deleteBatch(keys) {
  if (keys.length === 0) return;

  let requestItems = {
    [tableName]: keys.map(({ PK, SK }) => ({
      DeleteRequest: { Key: { PK: { S: PK }, SK: { S: SK } } },
    })),
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (dryRun) return;

    const result = await client.send(
      new BatchWriteItemCommand({ RequestItems: requestItems })
    );

    const unprocessed = result.UnprocessedItems?.[tableName];
    if (!unprocessed?.length) return;

    requestItems = { [tableName]: unprocessed };
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100));
  }

  throw new Error(`Failed to delete ${requestItems[tableName].length} item(s) after retries`);
}

async function main() {
  console.log(
    `Clearing telemetry for match ${matchId} in ${tableName} (${region})${
      dryRun ? " [dry-run]" : ""
    }...`
  );

  let deleted = 0;
  let lastEvaluatedKey;

  do {
    const page = await queryKeys(lastEvaluatedKey);

    for (let i = 0; i < page.keys.length; i += WRITE_BATCH) {
      const chunk = page.keys.slice(i, i + WRITE_BATCH);
      await deleteBatch(chunk);
      deleted += chunk.length;
      if (chunk.length > 0) {
        process.stdout.write(`  • deleted ${chunk.length} (running total ${deleted})\n`);
      }
    }

    lastEvaluatedKey = page.lastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(
    `\nTelemetry clear complete — ${dryRun ? "would delete" : "deleted"} ${deleted} event(s) for ${matchId}.`
  );
  if (!dryRun && deleted > 0) {
    console.log("Refresh the dashboard to clear any events already held in the browser.");
  }
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
