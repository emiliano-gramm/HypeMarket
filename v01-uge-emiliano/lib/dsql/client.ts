import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function withDsqlClient<T>(
  fn: (client: pg.Client) => Promise<T>
): Promise<T> {
  const host = requireEnv("DSQL_HOST");
  const region = process.env.AWS_REGION ?? "us-east-2";

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
