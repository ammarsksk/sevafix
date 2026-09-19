# SevaFix web application

The citizen and reviewer frontend for SevaFix. It is a Next.js 16 application connected directly to the deployed AWS Cognito, API Gateway, Lambda, S3, DynamoDB, Step Functions, Textract, and Bedrock backend.

## Run locally

Requirements: Node.js 20+, npm, and a deployed SevaFix backend.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Fill `.env.local` with the CloudFormation outputs from the backend stack. Open http://localhost:3000. The local origin must also match the backend `AllowedOrigin` parameter.

## Verification

```powershell
npm run lint
npm run build
npm run test:live
```

`test:live` uses the configured AWS CLI profile, creates a disposable Cognito citizen, starts the production build, runs the complete workflow in Microsoft Edge, requests a real AI diagnosis, queues account deletion, and cleans up the temporary user. Run `npm run build` first.

The verified workflow covers both product journeys: creating a scheme application from scratch and importing a failed outside application as a grievance. It also covers document processing, validation, frozen review, submission/timeline tracking, AI rejection diagnosis with citations, corrected-application creation, reviewer access, and account deletion.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_AWS_REGION` | AWS region containing Cognito and the API |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito user pool ID |
| `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Public Cognito app client ID |
| `NEXT_PUBLIC_SEVAFIX_API_URL` | API Gateway stage URL, without a trailing slash |

`.env.local` is intentionally ignored by Git. Commit `.env.example`, never personal credentials or AWS access keys.

## Production hosting

Set the four public environment variables in the hosting platform and run `npm run build`. If the production site uses a different domain, redeploy the backend with that exact URL as `AllowedOrigin`; API Gateway and the private document bucket both enforce it.
