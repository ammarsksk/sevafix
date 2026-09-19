# SevaFix full user-flow mock run

Run date: 20 September 2026 (IST)

## Result

**PASS** — the deployed SevaFix citizen flow completed end to end with a disposable synthetic user and four fictional PDF documents.

- Catalog loaded all 10 government schemes.
- PM-USP was the application-ready scheme used for the test.
- A fresh application was created for the fictional student **Aarav Mehta**.
- All required draft fields were saved.
- Marksheet, income certificate, admission evidence, and identity-consistency evidence were uploaded.
- All four documents completed scanning/OCR and reached **Confirmed**.
- Validation returned **13 passed, 0 failed, 0 need review, 0 blocked**.
- Version 1 was frozen.
- A synthetic submission reference and timeline note were recorded inside SevaFix.
- The diagnosis flow returned an AI-assisted, cited result.
- A corrected application draft was created from the diagnosis.

No government portal submission was made. `NSP-MOCK-1789851422093` was a synthetic reference stored only in the disposable SevaFix test application.

## Evidence

1. [Dashboard](01-dashboard.png)
2. [Ten-scheme catalog](02-scheme-catalog.png)
3. [Completed PM-USP draft](03-completed-draft.png)
4. [Four processed documents](04-documents-processed.png)
5. [Validation results](05-validation-results.png)
6. [Frozen version](06-frozen-version.png)
7. [Tracking timeline](07-tracking-timeline.png)
8. [AI-assisted diagnosis](08-diagnosis.png)
9. [Corrected application draft](09-repair-draft.png)

The machine-readable result is in [mock-run-report.json](mock-run-report.json).

## Synthetic test data

- Student: Aarav Mehta
- Application type: Fresh
- Annual family income: INR 3,00,000
- Class XII board percentile: 92
- Category: General
- Course: Regular degree, year 1
- Institution: National Institute of Test Studies
- AISHE code: C-99999 (synthetic)

Every PDF is prominently marked `FICTIONAL TEST DOCUMENT - NOT VALID FOR OFFICIAL USE`. The identity fixture is explicitly not Aadhaar, PAN, or a government ID and contains no real identity number.
