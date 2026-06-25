import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { MATCH_ID, type TelemetryEvent } from "@/lib/telemetry/types";

const DEFAULT_TABLE = "MatchTelemetry";
const DEFAULT_REGION = "us-east-2";

function isTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.PK === "string" &&
    typeof row.SK === "string" &&
    typeof row.PlayerId === "string" &&
    typeof row.Action === "string"
  );
}

export async function fetchRecentTelemetryEvents(
  matchId: string = MATCH_ID,
  limit = 120
): Promise<TelemetryEvent[]> {
  const tableName = process.env.TELEMETRY_TABLE_NAME ?? DEFAULT_TABLE;
  const region = process.env.AWS_REGION ?? DEFAULT_REGION;
  const cappedLimit = Math.min(Math.max(limit, 1), 200);

  const client = new DynamoDBClient({ region });
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": { S: `MATCH#${matchId}` },
        ":skPrefix": { S: "EVENT#" },
      },
      ScanIndexForward: false,
      Limit: cappedLimit,
    })
  );

  const nowSec = Math.floor(Date.now() / 1000);

  return (result.Items ?? [])
    .map((item) => unmarshall(item))
    .filter(isTelemetryEvent)
    .filter((event) => event.ExpiryTimestamp >= nowSec);
}
