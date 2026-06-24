import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

/** Fire-and-forget aggregator invoke so poll_totals refresh soon after a vote. */
export function triggerPollAggregator(): void {
  const functionName = process.env.POLL_AGGREGATOR_LAMBDA_NAME;
  if (!functionName) return;

  const region = process.env.AWS_REGION ?? "us-east-2";
  const client = new LambdaClient({ region });

  client
    .send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "Event",
      })
    )
    .catch(() => undefined);
}
