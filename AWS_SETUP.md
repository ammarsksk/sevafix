# SevaFix AWS setup status

Last updated: 19 September 2026

## Selected defaults

- AWS Region: `ap-south-1` (Mumbai)
- Initial environment: `dev`
- AWS CLI bootstrap profile: `sevafix` (root browser session logged out after bootstrap)
- CLI source profile: `sevafix-key-source` (IAM user with one locally stored access key)
- Deployment profile: `sevafix-deploy` (sources `sevafix-key-source` and assumes the restricted deployment role)
- Resource-name prefix: `sevafix-`
- Authentication for SevaFix citizens: Cognito verified email/password with SRP/password auth, optional TOTP MFA, short-lived tokens and refresh-token revocation

## Completed

- AWS CLI v2 installed and verified.
- AWS account and Mumbai Region verified.
- Root account has MFA enabled and has no root access keys.
- Created IAM user `sevafix-deployer` with one locally stored bootstrap access key and no direct application permissions beyond assuming the deployment role.
- Attached `SignInLocalDevelopmentAccess` to permit `aws login` temporary credentials.
- Limited the user to assuming `sevafix-deployment-role`.
- Created `sevafix-deployment-role` with `PowerUserAccess` plus IAM mutation/pass-role permissions restricted to `sevafix-*` roles and approved AWS services.
- Stored bootstrap trust and permission policies in `infra/bootstrap/`.
- Configured and verified `sevafix-key-source` as IAM user `sevafix-deployer`.
- Configured and verified `sevafix-deploy` as assumed role `sevafix-deployment-role`.
- Logged out the cached root browser sessions from profiles `sevafix` and `sevafix-user`.
- Deployed CloudFormation stack `sevafix-dev` in Mumbai with Cognito, API Gateway, Lambda, DynamoDB, S3/KMS, Step Functions, Textract, SQS/SNS, EventBridge Scheduler, CloudWatch, S3 Vectors and a Bedrock Knowledge Base.
- Seeded PM-USP CSSS policy versions `.1` and `.2`; `.2` is active with 22 fields, 16 deterministic rules, 12 reviewed claims and five monitored official sources.
- Verified the full live citizen workflow with disposable users, checksum uploads, Step Functions/Textract, validation, versioning, repair, notification and deletion.
- Deployed and verified cited AI diagnosis through Bedrock Mantle using `openai.gpt-oss-20b`; the focused run passed authentication, asynchronous diagnosis and cleanup.

## Current verification command

```powershell
aws sts get-caller-identity --profile sevafix-deploy
```

The ARN must contain `assumed-role/sevafix-deployment-role`.

The access key is a pragmatic bootstrap credential stored by AWS CLI in the local shared credentials file. It must be rotated regularly and removed after migration to IAM Identity Center or another temporary-credential workflow. It belongs to a user whose application permission is limited to assuming the SevaFix deployment role; never copy it into the repository or chat.

## Information still needed

- A monthly AWS budget alert amount in USD (recommended hackathon starting point: `$20`). This is an alert, not a hard spending cap.
- The email address that should receive and confirm AWS Budget alerts.
- Optional custom domain name. If omitted, the dev stack will use AWS-generated URLs and localhost callback URLs initially.
- Confirmation that only the `dev` environment should be deployed now (recommended). Production should wait for the working vertical slice and security review.
- AWS account verification or Support resolution for Titan Text Embeddings V2 if semantic Knowledge Base retrieval is required. This does not block the deployed Bedrock Mantle AI diagnosis.
- Explicit cost approval before enabling GuardDuty Malware Protection for S3 (`EnableMalwareProtection=true`).

Never provide a root password, IAM password, MFA code, access-key ID or secret access key in chat or repository files.
