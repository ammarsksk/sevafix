# SevaFix data ingestion and live acceptance report

Report date: 19 September 2026  
AWS stack: `sevafix-dev`  
AWS Region: `ap-south-1`  
Result: **PASS for the deterministic product and deployed Bedrock AI diagnosis; managed Knowledge Base ingestion remains account-blocked**

## Scope

The repository's approved MVP scope supports one scheme: **PM-USP Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)**. “All policies for all schemes” therefore means the complete reviewed policy package for this supported scheme, covering both fresh and renewal applications. This load is not represented as a complete catalog of every Government of India scheme.

Active immutable policy version: `pm-usp-csss-2026-27.2`

Revision 2 corrects a checklist consistency issue found during acceptance: renewal now visibly requests the identity and current-admission evidence used by the shared name and institution checks. Eligibility thresholds are unchanged from revision 1, which remains stored as audit history.

## Authoritative data loaded

Only official government sources are registered:

1. [PM-USP CSSS guidelines applicable from AY 2022-23 onward](https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_07022024_updated.pdf)
2. [PM-USP CSSS FAQ 2025-26](https://scholarships.gov.in/public/schemeGuidelines/FAQ_DOHE_CSSS.pdf)
3. [National Scholarship Portal scheme list 2026-27](https://scholarships.gov.in/All-Scholarships)
4. [National Scholarship Portal announcements](https://scholarships.gov.in/ViewMoreAnnouncement)
5. [Ministry of Education scholarships and education-loan page](https://www.education.gov.in/en/scholarships-education-loan-0)

The loader fetched every source over HTTPS, rejected untrusted redirects/content types, hashed the official content, preserved the two source PDFs in the policy S3 prefix, and stored provenance for every executable rule and reviewed claim. The two broad legacy source URLs remain in history but are disabled and point to their page-specific replacements.

## Live data inventory

| Item | Verified live value |
|---|---:|
| Active schemes | 1 |
| Supported application types | 2 (`FRESH`, `RENEWAL`) |
| Form fields | 22 |
| Deterministic rules | 16 |
| Page/section-backed policy claims | 12 |
| Enabled official source monitors | 5 |
| Fresh checklist entries | 6 |
| Renewal checklist entries | 4 |
| Official PDFs preserved for retrieval | 2 |

The current NSP renewal window has a real conflict: the scheme card and announcements page expose different closing dates. It is stored as `CONFLICT_REQUIRES_HUMAN_REVIEW`; no executable deadline rule was invented.

## End-to-end live results

The run used disposable Cognito users and one-page, watermarked synthetic PDFs. No real citizen data was used.

| Workflow | Result |
|---|---|
| Health, Cognito login, role groups, profile, catalog | PASS |
| Official-source monitoring | PASS — 5 checked, 0 changed, 0 failed |
| Fresh draft before evidence | PASS — correctly `ACTION_REQUIRED` with 6 blocked checks |
| Fresh upload/checksum/Step Functions/Textract | PASS — 4 documents processed |
| Low-confidence human confirmation path | PASS |
| Fresh deterministic validation | PASS — 12/12 applicable checks, 0 failed, ready |
| Immutable application versions | PASS — V1, V2 and repaired V3 |
| Authorized document view URL | PASS |
| Official-submission record and timeline event | PASS |
| Rejection diagnosis | PASS — `INCOME_MISMATCH` through `openai.gpt-oss-20b`, with verified claim citation `C1` |
| Repair case and corrected draft | PASS |
| Single-document deletion | PASS |
| Renewal upload/checksum/Step Functions/Textract | PASS — 4 documents processed |
| Renewal deterministic validation | PASS — 12/12 applicable checks, 0 failed, ready |
| Source-change reviewer approval and rejection | PASS |
| Policy rollback pointer and restoration | PASS — active revision restored to `.2` |
| Notification Lambda to SNS | PASS |
| Account and citizen-data deletion | PASS |
| Disposable-user cleanup | PASS — Cognito user list verified empty |

The canonical full-workflow evidence is [latest.json](artifacts/acceptance/latest.json). The focused live AI evidence is [mantle-diagnosis-latest.json](artifacts/acceptance/mantle-diagnosis-latest.json). The reusable runners are [acceptance_live.py](backend/scripts/acceptance_live.py) and [smoke_mantle_diagnosis.py](backend/scripts/smoke_mantle_diagnosis.py).

## Bedrock status

Generative diagnosis is operational in Mumbai through the AWS Bedrock Mantle Responses API using `openai.gpt-oss-20b`. The Lambda uses SigV4 with least-privilege `bedrock-mantle:CreateInference`, sends `store: false`, redacts common direct identifiers, allows only known diagnosis categories, and accepts citations only from retrieved verified claims. If managed Knowledge Base retrieval is unavailable, it ranks the immutable reviewed claims already stored in DynamoDB; if AI or evidence validation fails, it still falls back deterministically.

The focused deployed acceptance run passed Cognito login, application creation, asynchronous Lambda invocation, the `INCOME_MISMATCH` diagnosis, a non-empty verified citation, and complete disposable-user deletion. Its evidence is recorded in `artifacts/acceptance/mantle-diagnosis-latest.json`.

The remaining limitation is semantic Knowledge Base retrieval through Titan embeddings:

The Titan Text Embeddings V2 model is available in Mumbai and the Knowledge Base, vector index, IAM service role, S3 data source, and policy artifacts exist. The account reports:

- agreement: `AVAILABLE`
- entitlement: `AVAILABLE`
- Region: `AVAILABLE`
- authorization: `NOT_AUTHORIZED`
- direct invocation: `ValidationException: Operation not allowed`
- Knowledge Base ingestion: blocked because its role cannot call that unauthorized embedding model

This is not an S3, loader, vector-index, or application-code failure. AWS documents that foundation-model use requires model authorization and suitable IAM/account controls in [Request access to models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html). Titan is an Amazon model, not a third-party Marketplace model, so accepting a third-party EULA is not the remedy. An account owner or AWS Support must resolve the account/model authorization. After it becomes `AUTHORIZED`, run:

```powershell
python backend\scripts\seed_verified.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
python backend\scripts\acceptance_live.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
```

Until then, rejection diagnosis uses verified DynamoDB claim retrieval rather than vector search. The Bedrock generation layer is live, cited, and fail-closed; Titan authorization is an enhancement gate, not a blocker for the demo's AI diagnosis.

## Repeatable verification

```powershell
python -m pytest backend\tests -q
python -m compileall backend\src backend\scripts
python backend\scripts\seed_verified.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1 --skip-ingestion
python backend\scripts\smoke_mantle_diagnosis.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
python backend\scripts\acceptance_live.py --stack sevafix-dev --profile sevafix-deploy --region ap-south-1
```

The loader is idempotent for immutable records: an identical package is accepted as unchanged, while the same policy version with different content is rejected.
