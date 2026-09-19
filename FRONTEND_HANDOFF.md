# SevaFix frontend handoff

This document is the source of truth for building the SevaFix web frontend against the currently deployed development backend. It was checked against the backend implementation and the live CloudFormation stack on 19 September 2026.

## 1. What SevaFix does

SevaFix helps a citizen prepare, verify, diagnose, and repair an application for an Indian government scheme. It does not submit an application to the government portal or decide eligibility.

The initial supported scheme is **PM-USP Central Sector Scheme of Scholarship for College and University Students** (`pm-usp-csss`). The intended citizen journey is:

1. Create an account and verify the email address.
2. Select a supported scheme.
3. Create an application and fill its draft fields.
4. Upload supporting documents directly to private S3 using a short-lived signed URL.
5. Wait for OCR, review uncertain extracted facts, and confirm them.
6. Run deterministic validation and fix failed or missing-evidence checks.
7. Freeze an immutable application version.
8. Submit manually on the official government portal.
9. Record the official application ID and timeline events in SevaFix.
10. If rejected, enter/upload the rejection reason, run diagnosis, and create a repair draft.

There is also a reviewer workflow for approving detected official-source changes and publishing immutable policy versions.

## 2. Live development environment

These identifiers are frontend configuration, not secrets:

```env
NEXT_PUBLIC_SEVAFIX_API_URL=https://r155h572fd.execute-api.ap-south-1.amazonaws.com/dev
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_WXRdiRGBo
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=2ijbnb082biogo3batf1shcput
```

Health check:

```http
GET https://r155h572fd.execute-api.ap-south-1.amazonaws.com/dev/health
```

The API was live and returned HTTP 200 when this handoff was produced.

Important: API Gateway and the document S3 bucket currently allow browser requests only from `http://localhost:3000`. Before deploying the frontend elsewhere, the backend must be redeployed with `AllowedOrigin` set to the exact production frontend origin. This is a single-origin setting; preview URLs will need a deliberate CORS strategy.

## 3. Recommended frontend stack

- Next.js with TypeScript.
- AWS Amplify Auth for the existing Cognito user pool.
- TanStack Query or an equivalent request cache for API state and polling.
- A client-side SHA-256 implementation using the browser Web Crypto API for uploads.
- A form library such as React Hook Form plus schema validation.

Install the minimum authentication packages:

```bash
npm install aws-amplify @aws-amplify/ui-react
```

The included `frontend-reference/` directory contains ready-to-copy authentication, API client, upload, and TypeScript type files. These are framework-neutral browser modules; add `"use client"` in a Next.js client boundary where appropriate.

## 4. Authentication

The user pool uses email as the username. Passwords require at least 10 characters with uppercase, lowercase, number, and symbol. Email verification, password recovery by verified email, optional authenticator-app TOTP MFA, refresh-token revocation, and seven-day refresh tokens are enabled. ID and access tokens expire after 15 minutes.

Configure Amplify with the existing pool; do not create a second Amplify backend or identity pool. Call the API with the **ID token**:

```ts
const session = await fetchAuthSession();
const token = session.tokens?.idToken?.toString();

await fetch(`${API_URL}/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

`/health` is the only public route. Every other endpoint needs `Authorization: Bearer <Cognito ID token>`.

Cognito groups are carried in the `cognito:groups` ID-token claim:

- `citizen`: normal user label; all authenticated users can use citizen endpoints.
- `policy-reviewer`: can use `/review/*` endpoints.
- `admin`: can use `/review/*` endpoints.

The frontend must never contain AWS access keys, deployment credentials, a client secret, or raw tokens in source control. The Cognito app client intentionally has no client secret.

## 5. Suggested screens and routes

| Frontend screen | Purpose | Main backend calls |
|---|---|---|
| `/login`, `/signup`, `/confirm-email`, `/forgot-password` | Cognito flows | Amplify Auth |
| `/dashboard` | Profile and application list | `GET /me`, `GET /applications` |
| `/schemes` | Supported schemes | `GET /schemes` |
| `/applications/new` | Choose scheme and create | `POST /applications` |
| `/applications/[id]/edit` | Draft form with autosave | `GET /applications/{id}`, `PATCH .../draft` |
| `/applications/[id]/documents` | Upload, OCR status, fact confirmation | upload/document endpoints and application refresh |
| `/applications/[id]/check` | Validation results/readiness | `POST .../validate`, `GET /jobs/{jobId}` |
| `/applications/[id]/review` | Full summary and freeze version | `POST .../versions` |
| `/applications/[id]/tracking` | Manual submission and timeline | official-submission/timeline endpoints |
| `/applications/[id]/diagnose` | Diagnose a rejection and begin repair | diagnosis/job/repair endpoints |
| `/settings` | Profile, notification opt-in, account deletion | `/me`, `/me/deletion` |
| `/review/source-changes` | Reviewer queue | `/review/source-changes*` |
| `/review/policies` | Publish or roll back policy pointer | reviewer policy endpoints |

Guard protected routes with the signed-in state. Guard reviewer screens with the JWT group claim as a UX measure; the backend independently enforces the group.

## 6. Current PM-USP form schema

The backend currently has no form-definition endpoint. Render these fields for scheme `pm-usp-csss` and send them as the keys of the `fields` object:

| Field key | Type | Suggested control | Meaning |
|---|---|---|---|
| `student.primaryName` | string | text input | Name as shown on official evidence |
| `student.familyAnnualIncomeINR` | integer | number input | Annual family income in INR |
| `student.enrolmentMode` | string | select | Use `REGULAR` for a regular course |
| `student.courseType` | string | select | For example `DEGREE`; `DIPLOMA` fails the current rule |
| `student.receivesOtherScholarship` | boolean | yes/no | Other scholarship or fee reimbursement |
| `student.boardPercentile` | number | number input | Relevant Class XII board percentile |
| `student.hasAcademicGap` | boolean | yes/no | Whether there is an academic gap |

Currently expected evidence types:

- `INCOME_CERTIFICATE`
- `ADMISSION_LETTER`
- `MARKSHEET`
- `IDENTITY_PROOF`
- A rejection notice can use a clear frontend constant such as `REJECTION_NOTICE`; diagnosis accepts any processed document ID.

Document MIME types: PDF, JPEG, PNG, and TIFF. Maximum size: 10 MiB.

## 7. API conventions

- Base URL comes from `NEXT_PUBLIC_SEVAFIX_API_URL`; do not append another `/dev`.
- Send and receive JSON unless uploading directly to the signed S3 URL.
- Successful responses contain the resource directly, except list responses use `{ "items": [...] }`.
- Dates are ISO-8601 strings. Send date/times in UTC where possible.
- Responses may include DynamoDB bookkeeping fields such as `PK`, `SK`, and GSI keys. Ignore unknown fields and never depend on those keys in UI code.
- All API responses use `Cache-Control: no-store`.
- `202` means asynchronous work was accepted. Poll the returned job or aggregate resource.
- Error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "correlationId": "request-or-correlation-id",
    "details": { "retryable": false }
  }
}
```

Expected codes include `VALIDATION_ERROR` (400), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `DEPENDENCY_ERROR` (502), and `INTERNAL_ERROR` (500). Display the message, log the correlation ID, and offer retry only when `error.details.retryable` is true. On 409, reload the application before resubmitting.

## 8. Citizen API

### Profile and schemes

| Method and path | Body | Result |
|---|---|---|
| `GET /me` | — | Profile or `{ sub, profileStatus: "EMPTY" }` |
| `PATCH /me` | Any of `displayName`, `locale`, `notificationEmail`, `notificationOptIn` | Updated profile |
| `GET /schemes` | — | `{ items: Scheme[] }` |
| `GET /schemes/{schemeId}` | — | Scheme |

### Applications

| Method and path | Body | Result |
|---|---|---|
| `POST /applications` | `{ "schemeId": "pm-usp-csss" }` | `201` application |
| `GET /applications` | — | `{ items: ApplicationSummary[] }` |
| `GET /applications/{appId}` | — | Aggregate shown below |
| `PATCH /applications/{appId}/draft` | `{ fields, expectedRevision }` | Updated application |
| `POST /applications/{appId}/versions` | `{}` | `201` immutable version |
| `POST /applications/{appId}/validate` | `{}` | `202` validation job |
| `POST /applications/{appId}/repairs` | Optional `{ diagnosisId }` | `201` repair case; draft is cloned from latest version |

Application aggregate:

```ts
{
  application: Application;
  documents: DocumentRecord[];
  versions: ApplicationVersion[];
  timeline: TimelineEvent[];
  validationRuns: ValidationRun[];
  checks: CheckResult[];
  diagnoses: Diagnosis[];
  repairs: RepairCase[];
}
```

Draft saves use optimistic concurrency. Always send the last observed `revision`. A successful patch increments it. Debounce autosave and serialize saves; parallel saves can correctly produce HTTP 409.

### Validation jobs

Start validation with `POST /applications/{appId}/validate`, then poll `GET /jobs/{jobId}` about every two seconds until `COMPLETED` or `FAILED`. Stop after a sensible timeout and allow manual retry.

Validation check states:

- `PASS`
- `FAIL`
- `NEEDS_REVIEW`
- `NOT_APPLICABLE`
- `BLOCKED_MISSING_EVIDENCE`
- `BLOCKED_SOURCE_STALE`

Readiness labels are `READY_WITH_SEVAFIX_CHECKS` and `ACTION_REQUIRED`. Treat “ready” as a SevaFix preparation result, not government approval.

### Document upload

Uploads are a three-stage browser flow:

1. Calculate the file SHA-256 as lowercase hexadecimal.
2. Create an upload session:

```http
POST /documents/uploads
Content-Type: application/json

{
  "applicationId": "app_...",
  "documentType": "IDENTITY_PROOF",
  "contentType": "application/pdf",
  "size": 104742,
  "sha256": "64-lowercase-hex-characters"
}
```

3. `PUT` the raw file bytes to `uploadUrl` with every header in `requiredHeaders`, unchanged. Do not add an Authorization header to this S3 request.
4. Call `POST /documents/{documentId}/complete` with `{}`.
5. Poll `GET /applications/{appId}` until the document reaches a terminal state.

Document state progression in the current development environment:

`PENDING_UPLOAD → UPLOADED → OCR_RUNNING → EXTRACTED | NEEDS_USER_CONFIRMATION | UNSUPPORTED_LANGUAGE | OCR_FAILED_FINAL`

`SCANNING`, `SCAN_CLEAN`, and `QUARANTINED` can also occur if malware protection is enabled later.

If the state is `NEEDS_USER_CONFIRMATION`, display the extracted facts and confidence values, let the user correct them, then call:

```http
PATCH /applications/{appId}/documents/{documentId}/facts

{ "facts": { "primaryName": "Aditi Sharma", "annualIncomeINR": 350000 } }
```

Other document endpoints:

| Method and path | Purpose |
|---|---|
| `POST /documents/{documentId}/view-url` | Obtain a three-minute signed view URL |
| `POST /applications/{appId}/documents/{documentId}/view-url` | Same operation with app ownership check |
| `DELETE /documents/{documentId}` | Delete/mark document deleted |
| `DELETE /applications/{appId}/documents/{documentId}` | Same operation with app path |

Open the returned signed view URL promptly. Do not persist it because it expires.

### Submission, tracking, diagnosis, and repair

Freeze at least one version before recording submission:

```http
POST /applications/{appId}/official-submission

{
  "officialApplicationId": "government-portal-id",
  "submittedAt": "2026-09-19T06:30:00.000Z"
}
```

The backend stores only a hash and redacted display form of the official ID.

Add a manual timeline event:

```http
POST /applications/{appId}/timeline-events

{
  "eventType": "STATUS_CHECKED",
  "payload": { "status": "UNDER_REVIEW" },
  "occurredAt": "2026-09-19T06:30:00.000Z"
}
```

Diagnose a rejection using text, a processed rejection document, or both:

```http
POST /applications/{appId}/diagnoses

{
  "reasonText": "Rejected because family income does not match certificate",
  "rejectionDocumentId": "doc_optional"
}
```

Poll the returned job. Diagnosis categories are `MISSING_DOCUMENT`, `INCOME_MISMATCH`, `NAME_MISMATCH`, `INELIGIBLE_COURSE`, `OTHER_SCHOLARSHIP_CONFLICT`, `PERCENTILE_NOT_VERIFIED`, `APPLICATION_DATA_ERROR`, `DEADLINE_OR_PROCESS`, and `UNKNOWN`.

Diagnosis is live through Bedrock Mantle with `openai.gpt-oss-20b`. The backend supplies reviewed policy claims from DynamoDB while Titan Knowledge Base ingestion remains account-blocked, validates returned citations, and falls back deterministically if AI/evidence validation fails. Render `citations` as official-source links when present and label an absent `usedModelId` as the safe fallback rather than an AI result.

### Account deletion

`POST /me/deletion` queues complete deletion. After accepting the request, show a final confirmation and sign the user out. Do not rely on polling the deletion job because the Cognito user itself is deleted during the operation.

## 9. Reviewer API

All routes require a `policy-reviewer` or `admin` group claim.

| Method and path | Body |
|---|---|
| `GET /review/source-changes` | — |
| `GET /review/source-changes/{changeId}` | — |
| `POST /review/source-changes/{changeId}/approve` | `{}` |
| `POST /review/source-changes/{changeId}/reject` | `{ "reason": "..." }` |
| `POST /review/policy-versions/{versionId}/publish` | Publish payload below |
| `POST /review/policy-versions/{versionId}/rollback-pointer` | `{ schemeId, auditReason, confirmation: "ROLLBACK" }` |

Publish payload:

```json
{
  "schemeId": "pm-usp-csss",
  "policyText": "# Reviewed policy...",
  "rules": [
    {
      "ruleId": "family-income-cap",
      "title": "Family income must not exceed INR 4.5 lakh",
      "severity": "BLOCKING",
      "requiredEvidence": ["INCOME_CERTIFICATE"],
      "assert": {
        "field": "student.familyAnnualIncomeINR",
        "op": "LTE",
        "value": 450000
      },
      "sourceRefs": ["education-csss-page"]
    }
  ],
  "sourceIds": ["education-csss-page"],
  "authority": "Ministry of Education, Government of India",
  "effectiveFrom": "2026-09-19",
  "effectiveDateConfidence": "CONFIRMED",
  "auditReason": "Reviewed official scheme update",
  "confirmation": "PUBLISH"
}
```

Allowed rule operations are `PRESENT`, `EQ`, `NEQ`, `LT`, `LTE`, `GT`, `GTE`, `IN`, `NOT_IN`, `DATE_BETWEEN`, and `NAME_SIMILAR`. A publication must contain 1–20 rules and a non-empty policy text. Publishing and rollback are consequential actions: require a confirmation modal, show the exact version, and never silently retry.

Current reviewer limitation: source-change records expose metadata and an internal snapshot key, but the API does not yet return a signed URL or content endpoint for the private snapshot. A full visual diff/review screen requires a small backend endpoint before it can be completed safely.

## 10. UX and security requirements

- Never claim that SevaFix guarantees eligibility, approval, or submission.
- Link users to the scheme’s `officialPortalUrl` for actual submission.
- Keep sensitive document content out of analytics, error trackers, console logs, URLs, and localStorage.
- Never proxy document bytes through the frontend server unless deliberately redesigning the upload architecture.
- Show upload progress and preserve the local file until the completion call succeeds.
- Treat OCR results as suggestions. Highlight confidence below 98 and require user confirmation when the backend requests it.
- Use accessible labels, keyboard navigation, high contrast, plain language, and responsive layouts. The target audience may use low-end mobile devices and intermittent networks.
- Autosave conservatively, show the last successful save time, and keep unsaved form data in memory when requests fail.
- Render status chips from backend values, but map them to friendly copy rather than exposing internal terminology alone.
- Provide English first, but structure copy through translation keys so Hindi and other Indian languages can be added without rewriting components.

## 11. Known integration gaps

These are backend limitations, not frontend bugs:

1. No dynamic form/evidence-schema endpoint; the current PM-USP schema is documented above.
2. No private reviewer snapshot-view endpoint.
3. No endpoint for listing full policy/rule history to reviewers.
4. Production CORS is not configured yet.
5. Titan Knowledge Base ingestion remains account-blocked; deployed AI diagnosis works through Bedrock Mantle with verified DynamoDB claims.
6. Malware scanning is disabled in development.
7. Notification infrastructure exists, but no email/SMS destination is subscribed yet.
8. Application submission to the official portal remains manual by design.

Do not fake these features in the frontend. Use a clear “not yet available” state or coordinate a backend addition.

## 12. Definition of frontend done

- Authentication covers sign-up, email confirmation, sign-in, sign-out, forgotten password, and token refresh.
- All authenticated API calls use the ID token and recover cleanly from session expiry.
- The application draft uses revision-aware saves.
- Uploads calculate SHA-256, send all signed headers, complete the upload, and show OCR states.
- Users can correct low-confidence extracted facts.
- Validation jobs are polled and every check state has a clear visual treatment.
- Users can freeze versions, record manual submission, track timeline events, diagnose rejection, and create a repair draft.
- Account deletion has a destructive confirmation and signs out after acceptance.
- Reviewer routes are hidden from non-reviewers and protected actions require confirmation.
- No credentials or citizen PII are committed, logged, or sent to analytics.
- Local operation works from `http://localhost:3000` against the live dev backend.
