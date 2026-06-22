import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from "@aws-sdk/client-cognito-identity";
import {
  CredentialsProvider,
  type AWSCredentials,
} from "aws-crt/dist.browser/browser/auth";

export class CognitoCredentialsProvider extends CredentialsProvider {
  private credentials?: AWSCredentials;
  private identityId?: string;

  constructor(
    private readonly region: string,
    private readonly identityPoolId: string
  ) {
    super();
  }

  getCredentials(): AWSCredentials | undefined {
    return this.credentials;
  }

  async refreshCredentials(): Promise<void> {
    const client = new CognitoIdentityClient({ region: this.region });

    if (!this.identityId) {
      const idResult = await client.send(
        new GetIdCommand({
          IdentityPoolId: this.identityPoolId,
        })
      );

      if (!idResult.IdentityId) {
        throw new Error("Cognito did not return an identity ID");
      }

      this.identityId = idResult.IdentityId;
    }

    const credsResult = await client.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: this.identityId,
      })
    );

    const creds = credsResult.Credentials;
    if (!creds?.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
      throw new Error("Cognito did not return valid session credentials");
    }

    this.credentials = {
      aws_region: this.region,
      aws_access_id: creds.AccessKeyId,
      aws_secret_key: creds.SecretKey,
      aws_sts_token: creds.SessionToken,
    };
  }
}
