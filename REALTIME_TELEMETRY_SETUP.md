# Real-Time Telemetry Setup (DynamoDB -> Lambda -> IoT -> Next.js)

This document captures the implementation plan for:

1. Subscribing from the Next.js frontend to `esports/telemetry/M-1001` using `aws-iot-device-sdk-v2`
2. Publishing real-time telemetry by fan-out from DynamoDB Streams through Lambda into AWS IoT Core

## 1) Frontend Subscription in Next.js

Your `.env.local` endpoint is the correct kind of value to expose publicly (`NEXT_PUBLIC_...`), but endpoint alone is not enough.  
The browser also needs temporary AWS credentials (recommended: Cognito Identity Pool) and an IoT policy that allows subscribe/receive.

### Browser Architecture

```text
Next.js Client Component
  -> (WSS + SigV4)
AWS IoT Core

Cognito Identity Pool
  -> temporary creds -> Next.js client

IoT topic:
  esports/telemetry/M-1001
```

### AWS Setup (one-time)

1. Create an IoT policy (example: `EsportsTelemetrySubscribe`) with:
   - `iot:Connect`
   - `iot:Subscribe`
   - `iot:Receive`

Example policy JSON (replace `ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["iot:Connect", "iot:Subscribe", "iot:Receive"],
      "Resource": [
        "arn:aws:iot:us-east-2:ACCOUNT_ID:client/*",
        "arn:aws:iot:us-east-2:ACCOUNT_ID:topicfilter/esports/telemetry/*",
        "arn:aws:iot:us-east-2:ACCOUNT_ID:topic/esports/telemetry/*"
      ]
    }
  ]
}
```

2. Create/Use a Cognito Identity Pool (guest or authenticated users).
3. Attach the IoT policy to the IAM role used by that identity pool.

### Frontend Environment Variables

In `v01-uge-emiliano/.env.local`:

```env
NEXT_PUBLIC_AWS_IOT_ENDPOINT=a32dwjh9raxrc2-ats.iot.us-east-2.amazonaws.com
NEXT_PUBLIC_AWS_REGION=us-east-2
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Install Dependencies

Run in `v01-uge-emiliano`:

```bash
npm install aws-iot-device-sdk-v2 @aws-sdk/credential-providers
```

### Next.js Client Component Example

Use a client component (not SSR) for MQTT websocket connection:

```tsx
"use client";

import { useEffect, useState } from "react";
import { mqtt, iot } from "aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

export default function TelemetrySubscriber() {
  const [events, setEvents] = useState<unknown[]>([]);

  useEffect(() => {
    let connection: mqtt.MqttClientConnection | null = null;

    async function connect() {
      const config = iot.AwsIotMqttConnectionConfigBuilder
        .new_builder_for_websocket()
        .with_endpoint(process.env.NEXT_PUBLIC_AWS_IOT_ENDPOINT!)
        .with_client_id(`web-${crypto.randomUUID()}`)
        .with_clean_session(true)
        .with_credential_provider(
          fromCognitoIdentityPool({
            clientConfig: { region: process.env.NEXT_PUBLIC_AWS_REGION! },
            identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!,
          })
        )
        .build();

      connection = mqtt.build_mqtt_connection(config);
      await connection.connect();

      await connection.subscribe(
        "esports/telemetry/M-1001",
        mqtt.QoS.AtLeastOnce,
        (_topic, payload) => {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          setEvents((prev) => [msg, ...prev].slice(0, 50));
        }
      );
    }

    connect().catch(console.error);

    return () => {
      connection?.disconnect();
    };
  }, []);

  return <pre>{JSON.stringify(events, null, 2)}</pre>;
}
```

### Important Frontend Notes

- Run this only in the browser (`"use client"` + `useEffect`).
- Do not put IAM access keys in `NEXT_PUBLIC_*`.
- If build issues occur, you may need Next config adjustments for this SDK.
- Alternative option: `@aws-amplify/pubsub` can simplify browser MQTT setup.

## 2) DynamoDB Stream -> Lambda -> IoT Core Fan-Out

This is a strong design for your use case.

### Why this pattern is good

- DynamoDB stays source of truth.
- IoT Core provides real-time fan-out to many clients.
- Producer remains simple (write to DynamoDB only).
- Easy to replay/audit from stored rows.

### High-level flow

```text
producer.js -> DynamoDB MatchTelemetry
               -> DynamoDB Stream
                  -> Lambda
                     -> IoT topic esports/telemetry/M-1001
                        -> Next.js subscribers
```

### Implementation Steps

1. Enable DynamoDB Stream on `MatchTelemetry`
   - Stream view type: `NEW_IMAGE`

2. Create Lambda execution role with:
   - Stream read permissions (`dynamodb:GetRecords`, `GetShardIterator`, `DescribeStream`, `ListStreams`)
   - `iot:Publish` on:
     - `arn:aws:iot:us-east-2:ACCOUNT_ID:topic/esports/telemetry/*`
   - CloudWatch log permissions

3. Lambda handler example (Node.js 20+):

```javascript
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const iot = new IoTDataPlaneClient({
  region: process.env.AWS_REGION,
  endpoint: `https://${process.env.IOT_ENDPOINT}`,
});

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;

    const item = unmarshall(record.dynamodb.NewImage);
    const matchId = item.PK.replace("MATCH#", "");

    await iot.send(
      new PublishCommand({
        topic: `esports/telemetry/${matchId}`,
        payload: Buffer.from(JSON.stringify(item)),
        qos: 0,
      })
    );
  }
};
```

4. Set Lambda environment variable:
   - `IOT_ENDPOINT` = your ATS endpoint hostname (without `https://` if code prepends it)

5. Add event source mapping:
   - Lambda trigger -> DynamoDB stream from `MatchTelemetry`
   - Start with batch size 10
   - Enable "bisect batch on error"

6. Ensure topic naming matches frontend:
   - Lambda publishes: `esports/telemetry/M-1001`
   - Frontend subscribes: `esports/telemetry/M-1001`

## End-to-End Validation

1. Run `producer.js` and verify rows in DynamoDB.
2. Check Lambda logs for successful publish.
3. In IoT Core MQTT test client, subscribe to `esports/telemetry/M-1001` and confirm messages.
4. Open Next.js app and verify the same events render live.

## Recommended Build Order

1. IoT Core + Cognito + MQTT test client
2. DynamoDB Stream -> Lambda -> IoT publish
3. Next.js subscriber component integration