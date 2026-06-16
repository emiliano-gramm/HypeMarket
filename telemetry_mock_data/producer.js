import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" }); // Match your AWS region

async function generateTelemetry() {
  const matchId = "M-1001";
  const timestamp = Date.now();
  const expiry = Math.floor(timestamp / 1000) + 86400; // 24 hours from now

  const payload = {
    PK: `MATCH#${matchId}`,
    SK: `EVENT#${timestamp}#${crypto.randomUUID()}`, // unique id for the event using crypto.randomUUID()
    PlayerId: `Player_${Math.floor(Math.random() * 10)}`,
    Action: ["Kill", "Assist", "Objective", "Movement"][Math.floor(Math.random() * 4)],
    CoordinateX: Math.random() * 100,
    CoordinateY: Math.random() * 100,
    ExpiryTimestamp: expiry
  };

  try {
    await client.send(new PutItemCommand({
        TableName: "MatchTelemetry",
        Item: marshall(payload)
    }));
    console.log(`[${timestamp}] Inserted event for ${payload.PlayerId}`);
  } catch (error) {
    console.error("DynamoDB write failed:", error);
  }
}

// Fire every 500ms
setInterval(generateTelemetry, 500);