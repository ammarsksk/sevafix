# SevaFix backend

The dev backend is deployed as CloudFormation stack `sevafix-dev` in `ap-south-1`.

## Live outputs

| Output | Value |
|---|---|
| API | `https://r155h572fd.execute-api.ap-south-1.amazonaws.com/dev` |
| Cognito user pool | `ap-south-1_WXRdiRGBo` |
| Cognito app client | `2ijbnb082biogo3batf1shcput` |
| DynamoDB table | `SevaFix-dev` |
| Knowledge base | `JXV1YUBHLD` |
| State machine | `sevafix-dev-document-pipeline` |

Bucket names and all current outputs should be read from CloudFormation rather than copied into application configuration:

```powershell
aws cloudformation describe-stacks --stack-name sevafix-dev --profile sevafix-deploy --region ap-south-1 --query "Stacks[0].Outputs" --output table
```

## Implemented components

- Cognito email/password authentication, verified-email recovery, optional TOTP MFA, token revocation, and citizen/reviewer/admin groups.
- API Gateway HTTP API with JWT authorization and ownership enforcement in every citizen data path.
- DynamoDB single-table records for users, applications, immutable versions, documents, jobs, validation runs/checks, diagnoses, repairs, timeline events, policy versions, rules, official sources, source changes, and policy audits.
- Encrypted, private, versioned citizen and policy S3 buckets; short-lived regional SigV4 upload/view URLs; declared byte size, MIME type, metadata, and SHA-256 checksum verification.
- Step Functions + Textract asynchronous OCR/query extraction, raw output preservation, low-confidence confirmation, explicit unsupported-language/manual-entry state, and automatic post-OCR validation.
- Deterministic version-pinned rule engine with evidence requirements and pass/fail/review/blocked states.
- Bedrock Mantle diagnosis using `openai.gpt-oss-20b` in Mumbai, SigV4, `store: false`, PII redaction, verified-claim citations, and deterministic fail-closed behavior. The prepared Knowledge Base/S3 Vectors path becomes the preferred retriever when Titan authorization is available; reviewed DynamoDB claims are used meanwhile.
- Daily HTTPS-only official-source monitoring with public-IP and redirect-host checks, snapshot hashes, duplicate suppression, and human review queue.
- Reviewer approve/reject, immutable policy publication, audited active-pointer rollback, and KB ingestion kickoff.
- Repair/V2 cloning, manual official-submission tracking, timelines, notification SQS/DLQ/SNS worker, account deletion, CloudWatch logs/alarm, X-Ray, PITR, KMS, and optional GuardDuty malware scanning.

## Main API routes

Live government scheme intelligence is supported by registering a source with
`sourceKind: "DATA_GOV_API"` in `SOURCES#REGISTRY`. The source monitor adds the
server-side `DATA_GOV_API_KEY` to data.gov.in requests, normalizes JSON before
hashing, and creates the same reviewer change record used for official webpages.
Set `DataGovApiKey` during deployment; never put the key in frontend code.
The scheme-catalog seed registers API-enabled catalogs for PM-KISAN, PMUY,
PMAY-G, and NSAP, official portals for every discovery scheme, and the PM-KISAN
operational-guidelines PDF. Stored endpoints never contain the API key. Schemes
without an API-enabled data.gov.in catalog are monitored through their official
government sources instead of using fabricated or static-resource endpoints.

For a key-safe deployment, run `backend/scripts/deploy_data_gov.ps1`. It asks
for the key using a hidden prompt, builds and deploys the stack, seeds the
scheme/source registry, and clears the plaintext key variable when it exits.

Citizen routes include `/me`, `/schemes`, `/applications`, `POST /grievances`, validation/version/repair/submission/timeline routes, `/documents/uploads`, document completion/view/deletion/fact confirmation, `/jobs/{id}`, and `/me/deletion`. `POST /grievances` accepts either an owned SevaFix application or an outside official application, freezes the pre-diagnosis state, and never stores the raw outside application ID.

Reviewer routes require the `policy-reviewer` or `admin` Cognito group:

- `GET /review/source-changes`
- `GET /review/source-changes/{changeId}`
- `POST /review/source-changes/{changeId}/approve`
- `POST /review/source-changes/{changeId}/reject`
- `POST /review/policy-versions/{versionId}/publish`
- `POST /review/policy-versions/{versionId}/rollback-pointer`

Policy publication requires an `auditReason`, `confirmation: "PUBLISH"`, a reviewed policy text, and 1–20 rules using the allowlisted rule operators. Rollback requires `confirmation: "ROLLBACK"`; it changes only the active pointer and preserves history.

## Build, deploy, seed, and verify

```powershell
python -m pytest -c backend\pytest.ini backend\tests
sam validate --template-file backend\template.yaml --lint --region ap-south-1 --profile sevafix-deploy
sam build --template-file backend\template.yaml --build-dir backend\.aws-sam\build --cached
cd backend
sam deploy --template-file .aws-sam\build\template.yaml --stack-name sevafix-dev --resolve-s3 --s3-prefix sevafix-dev --region ap-south-1 --profile sevafix-deploy --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=dev AllowedOrigin=http://localhost:3000 EnableMalwareProtection=false EnableKnowledgeBase=true BedrockModelId=global.amazon.nova-2-lite-v1:0 BedrockMantleModelId=openai.gpt-oss-20b
cd ..
python backend\scripts\seed.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
python backend\scripts\smoke_mantle_diagnosis.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
python backend\scripts\smoke_live.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
```

The live smoke script creates a disposable Cognito user and application, validates a draft, freezes V1, uploads the repository PDF with a signed checksum, executes Textract through Step Functions, diagnoses an income mismatch, and exercises deletion. Its `finally` path invokes the deletion worker if any stage fails.

## Account-level feature gates

- Bedrock generative inference is deployed and live through the Mantle Responses API with `openai.gpt-oss-20b`; the focused disposable-user smoke test is recorded in `artifacts/acceptance/mantle-diagnosis-latest.json`.
- This account still reports `authorizationStatus: NOT_AUTHORIZED` for Titan Text Embeddings V2, so managed Knowledge Base ingestion cannot run. Diagnosis remains AI-powered by retrieving reviewed claims from DynamoDB and automatically uses the Knowledge Base when Titan is later authorized.
- GuardDuty Malware Protection resources are defined but `EnableMalwareProtection=false` in dev because enabling it creates per-object scanning charges. Set it to `true` only after cost approval.
- SNS is deployed and the notification worker is verified, but no email/SMS subscription is created without a destination and opt-in.

Do not put credentials, raw citizen documents, access tokens, OTPs, or secrets in this repository.
