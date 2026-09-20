# SevaFix faulty-document demo run

Run date: 20 September 2026 (IST)

## Result

**PASS** - the deployed SevaFix citizen flow completed end to end with a disposable synthetic user and fictional PDF documents.

- The catalog loaded all 10 schemes.
- A fresh PM-USP application was created for fictional student **Aarav Mehta**.
- All required draft fields were saved.
- Four documents completed the real signed-upload, S3, Step Functions, Textract, confirmation, and validation pipeline.
- The deliberately faulty income certificate contained INR 9,00,000 while the form contained INR 3,50,000.
- The first validation returned **12 passed, 1 failed, 0 need review, 0 blocked**.
- Version 1 was frozen and a synthetic submission/timeline event was recorded inside SevaFix.
- With no rejection reason supplied, AI-assisted diagnosis inferred **INCOME MISMATCH** from the failed check.
- A repair draft was started, the faulty certificate was replaced with a corrected INR 3,50,000 certificate, and validation returned **13 passed, 0 failed, 0 need review, 0 blocked**.

No government portal submission was made. The synthetic reference was stored only in the disposable SevaFix test application, which was deleted after the run.

## Evidence

1. [Dashboard](01-dashboard.png)
2. [Ten-scheme catalog](02-scheme-catalog.png)
3. [Completed PM-USP draft](03-completed-draft.png)
4. [Four processed documents](04-documents-processed.png)
5. [Fault detected](05-fault-detected.png)
6. [Frozen version](06-frozen-version.png)
7. [Tracking timeline](07-tracking-timeline.png)
8. [AI-assisted diagnosis](08-diagnosis.png)
9. [Repair draft](09-repair-draft.png)
10. [Corrected document](10-corrected-document.png)
11. [Correction passed](11-correction-passed.png)

The machine-readable result is in [mock-run-report.json](mock-run-report.json). A separate live API acceptance report is in `artifacts/acceptance/faulty-document-mock-latest.json`.

## Synthetic test data

- Student: Aarav Mehta
- Declared family income: INR 3,50,000
- Faulty certificate income: INR 9,00,000
- Corrected certificate income: INR 3,50,000
- Class XII board percentile: 92
- Category: General
- Course: Regular degree, year 1
- Institution: National Institute of Test Studies
- AISHE code: C-99999 (synthetic)

Every PDF is prominently marked `FICTIONAL TEST DOCUMENT - NOT VALID FOR OFFICIAL USE`. The identity fixture is explicitly not Aadhaar, PAN, or a government ID and contains no real identity number.
