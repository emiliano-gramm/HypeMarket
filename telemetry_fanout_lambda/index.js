const { IoTDataPlaneClient, PublishCommand } = require("@aws-sdk/client-iot-data-plane");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const iot = new IoTDataPlaneClient({
  region: process.env.AWS_REGION,
  endpoint: `https://${process.env.IOT_ENDPOINT}`,
});

exports.handler = async (event) => {
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
