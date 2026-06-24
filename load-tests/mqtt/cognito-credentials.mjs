import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from "@aws-sdk/client-cognito-identity";
import { iot, mqtt } from "aws-iot-device-sdk-v2";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function fetchCognitoCredentials(region, identityPoolId) {
  const client = new CognitoIdentityClient({ region });

  const idResult = await client.send(
    new GetIdCommand({ IdentityPoolId: identityPoolId })
  );
  if (!idResult.IdentityId) {
    throw new Error("Cognito did not return an identity ID");
  }

  const credsResult = await client.send(
    new GetCredentialsForIdentityCommand({
      IdentityId: idResult.IdentityId,
    })
  );

  const creds = credsResult.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
    throw new Error("Cognito did not return valid session credentials");
  }

  return {
    identityId: idResult.IdentityId,
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretKey,
    sessionToken: creds.SessionToken,
  };
}

export async function connectSubscriber({
  region,
  endpoint,
  identityPoolId,
  topic,
  clientId,
  onMessage,
}) {
  const creds = await fetchCognitoCredentials(region, identityPoolId);

  const config = iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
    .with_endpoint(endpoint)
    .with_client_id(clientId)
    .with_clean_session(true)
    .with_keep_alive_seconds(30)
    .with_credentials(
      region,
      creds.accessKeyId,
      creds.secretAccessKey,
      creds.sessionToken
    )
    .build();

  const client = new mqtt.MqttClient();
  const connection = client.new_connection(config);

  let messageCount = 0;

  connection.on("error", (err) => {
    throw err;
  });

  await connection.connect();
  await connection.subscribe(topic, mqtt.QoS.AtLeastOnce, (_topic, payload) => {
    messageCount += 1;
    if (onMessage) {
      onMessage(payload, messageCount);
    }
  });

  return {
    connection,
    getMessageCount: () => messageCount,
    disconnect: async () => {
      await connection.disconnect();
    },
  };
}

export function getMqttConfigFromEnv() {
  return {
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: requireEnv("AWS_IOT_ENDPOINT"),
    identityPoolId: requireEnv("COGNITO_IDENTITY_POOL_ID"),
    topic:
      process.env.TELEMETRY_TOPIC ||
      `esports/telemetry/${process.env.MATCH_ID || "M-1001"}`,
  };
}
