# New Computer Setup Guide

Use this checklist when moving this project to a different machine.

## 1) Install Required Tools

Install these first:

- `git`
- `node` (use the same major version you used here)
- `npm`
- `aws` CLI v2
- `vercel` CLI

Optional but recommended:

- `nvm` (to manage Node versions)

Verify installs:

```bash
git --version
node -v
npm -v
aws --version
vercel --version
```

## 2) Clone Repo and Install Dependencies

```bash
git clone <YOUR_REPO_URL>
cd Ultimate_Global_Entertainment
```

Install dependencies in each project:

```bash
cd telemetry_mock_data && npm install
cd ../v01-uge-emiliano && npm install
cd ..
```

## 3) Recreate Local Environment Files (Manual)

These files are intentionally not committed. You must recreate them locally.

### `v01-uge-emiliano/.env.local`

Current known required fields:

```env
NEXT_PUBLIC_AWS_IOT_ENDPOINT="<FILL_ME_IOT_ENDPOINT_HOSTNAME>"
NEXT_PUBLIC_AWS_REGION="<FILL_ME_REGION>"
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID="<FILL_ME_COGNITO_IDENTITY_POOL_ID>"
```

Fill these yourself:

- `<FILL_ME_IOT_ENDPOINT_HOSTNAME>` example format: `xxxxxxxxxxxxxx-ats.iot.us-east-2.amazonaws.com`
- `<FILL_ME_REGION>` example: `us-east-2`
- `<FILL_ME_COGNITO_IDENTITY_POOL_ID>` example format: `us-east-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Do **not** commit secrets or private credentials to `.env.local`.

## 4) AWS Authentication Setup (Manual)

Choose one of these:

### Option A: Access keys (manual credentials)

```bash
aws configure
```

You must provide:

- `AWS Access Key ID` -> `<FILL_ME_AWS_ACCESS_KEY_ID>`
- `AWS Secret Access Key` -> `<FILL_ME_AWS_SECRET_ACCESS_KEY>`
- `Default region name` -> `<FILL_ME_AWS_REGION>`
- `Default output format` -> `json` (recommended)

### Option B: AWS SSO (recommended for teams)

```bash
aws configure sso
aws sso login
```

You must provide:

- `<FILL_ME_SSO_START_URL>`
- `<FILL_ME_SSO_REGION>`
- `<FILL_ME_ACCOUNT_ID>`
- `<FILL_ME_ROLE_NAME>`

### Verify AWS works

```bash
aws sts get-caller-identity
aws configure list
```

## 5) Vercel Setup (Manual)

```bash
vercel login
cd v01-uge-emiliano
vercel link
```

If Vercel stores env vars for this project, pull them:

```bash
vercel env pull .env.local
```

Fill/confirm these yourself during linking:

- `<FILL_ME_VERCEL_TEAM_OR_USER>`
- `<FILL_ME_VERCEL_PROJECT_NAME>`

## 6) Project-Specific AWS Resource Checks

Confirm these resources/settings exist in the expected account and region:

- DynamoDB table: `<FILL_ME_DDB_TABLE_NAME>` (currently expected: `MatchTelemetry`)
- Region: `<FILL_ME_REGION>` (currently expected: `us-east-2`)
- IoT endpoint in `.env.local` matches the same region/account
- IoT policy allows connect/subscribe/receive for telemetry topics
- Cognito Identity Pool ID in `.env.local` is correct

## 7) Run Smoke Tests

From repo root:

```bash
cd telemetry_mock_data
node producer.js
```

Expected behavior:

- Repeating logs every ~500ms
- Successful inserts, or clear AWS connectivity/auth errors

Stop producer with:

- `Ctrl+C`

Run frontend:

```bash
cd ../v01-uge-emiliano
npm run dev
```

Open the shown local URL (typically `http://localhost:3000`).

## 8) Common Failure Points

- Wrong AWS profile/account active
- Wrong AWS region (must match IoT and DynamoDB resources)
- Missing/incorrect `.env.local`
- Expired SSO login token (`aws sso login` again)
- Vercel project linked to wrong team/project

## 9) Security Notes

Never commit:

- `.env` or `.env.*` files with secrets
- AWS access keys
- private key files (`*.pem`, `id_rsa`, etc.)

Safe to commit:

- `NEXT_PUBLIC_*` non-secret values (endpoint hostnames, public IDs)
- source code, lockfiles, docs

## 10) Quick Bring-Up Command List

```bash
git clone <YOUR_REPO_URL>
cd Ultimate_Global_Entertainment
cd telemetry_mock_data && npm install && cd ..
cd v01-uge-emiliano && npm install && cd ..
# create v01-uge-emiliano/.env.local manually
aws sts get-caller-identity
cd telemetry_mock_data && node producer.js
```

