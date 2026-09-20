# SevaFix live demo run

This pack is entirely fictional and is for demonstrating SevaFix only. Every PDF is visibly marked **FICTIONAL TEST DOCUMENT - NOT VALID FOR OFFICIAL USE**. Do not upload these files to a government portal.

## Demo story

The fictional student **Aarav Mehta** enters an annual family income of **INR 3,50,000**. The first income certificate deliberately says **INR 9,00,000**. SevaFix should detect the mismatch without needing an official rejection reason. The presenter then replaces it with the corrected certificate and runs the check again.

## Form values

Use the **PM-USP CSSS** scheme and choose **Fresh**.

| Field | Value |
|---|---|
| Name | Aarav Mehta |
| Annual family income | 350000 |
| Class XII board percentile | 92 |
| Academic gap | No |
| Other scholarship/fee reimbursement | No |
| NSP One-Time Registration ready | Yes |
| Category | General |
| Benchmark disability | No |
| Bank ready for DBT | Yes |
| Enrolment mode | Regular |
| Course type | Degree |
| Course year | 1 |
| Institution | National Institute of Test Studies |
| AISHE code | C-99999 |
| Institution recognized | Yes |
| AISHE status active | Yes |

## First upload: demonstrate the fault

Upload these files into their matching slots:

| Website slot | File |
|---|---|
| Class XII marksheet | `sevafix_mock_class_xii_marksheet.pdf` |
| Family income certificate | `sevafix_mock_income_certificate_FAULTY.pdf` |
| Admission/course/institution evidence | `sevafix_mock_admission_letter.pdf` |
| Identity evidence | `sevafix_mock_identity_proof.pdf` |

Wait for document reading to finish. If SevaFix asks you to confirm extracted facts, keep the name as **Aarav Mehta** and the faulty certificate income as **900000**. Do not change the extracted value to match the form—the mismatch is the point of the demo.

Open **Check** and select **Run validation**. Expected result:

- `fresh income certificate match` is **Fail**.
- The declared form value is INR 3,50,000.
- The document value is INR 9,00,000.
- The application is marked **Action required**.

Freeze Version 1 on **Review & freeze**. Then open **Diagnose**, leave the rejection reason empty, and select **Diagnose application**. SevaFix should infer **Income mismatch** from its own checks and clearly state that this is a likely issue, not an official rejection reason.

## Correction

Select **Start corrected application**, return to **Documents**, delete the faulty income certificate, and upload:

`sevafix_mock_income_certificate_CORRECTED.pdf`

If confirmation is requested, confirm the corrected income as **350000**. Run validation again. Expected result: **13 passed, 0 failed, 0 blocked** and **Ready with SevaFix checks**.

## Regenerating the documents

From the repository root:

```powershell
python backend\scripts\create_mock_documents.py
```

The PDFs are generated in `output\pdf`.
