# PM-USP CSSS verified policy package

Policy version: `pm-usp-csss-2026-27.2`

Verification date: 2026-09-19

Revision note: the renewal checklist now explicitly includes the identity and current admission evidence required by the shared name and institution checks. No eligibility threshold changed from revision 1.

Scheme: Pradhan Mantri Uchchatar Shiksha Protsahan Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)

Authority: Department of Higher Education, Ministry of Education, Government of India

Official application portal: https://scholarships.gov.in/

This is a reviewed SevaFix representation of the official scheme. The official authority and National Scholarship Portal remain authoritative. A SevaFix readiness result is not an eligibility determination, selection decision, or submission.

## Source set

1. PM-USP CSSS Guidelines, applicable from academic year 2022-23 onward, hosted by the National Scholarship Portal: https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_07022024_updated.pdf
2. PM-USP CSSS Frequently Asked Questions 2025-26, hosted by the National Scholarship Portal: https://scholarships.gov.in/public/schemeGuidelines/FAQ_DOHE_CSSS.pdf
3. National Scholarship Portal scheme listing for academic year 2026-27: https://scholarships.gov.in/All-Scholarships
4. National Scholarship Portal announcements for academic year 2026-27: https://scholarships.gov.in/ViewMoreAnnouncement
5. Ministry of Education scholarship and education-loan page: https://www.education.gov.in/en/scholarships-education-loan-0

The scheme guidelines and FAQ control stable eligibility and renewal rules. Live portal pages control current operational dates. Portal dates are stored separately from eligibility because they can change.

## Objective and scope

The scheme provides financial assistance to meritorious students from lower-income families for part of their day-to-day expenses during higher studies. The guidelines state a maximum of 82,000 fresh scholarships annually, allocated across boards, streams, categories, gender, and state quotas. Meeting individual eligibility checks does not guarantee selection because awards are subject to merit lists and slot allocation.

## Fresh-application conditions represented by SevaFix

- The applicant must be above the 80th percentile of successful Class XII candidates in the relevant stream and board.
- The applicant must be in the first year of a regular degree course. Correspondence, distance-mode, and diploma study are not eligible.
- The institution and course must be recognized by the relevant regulatory body, and the institution must have a valid/active AISHE record.
- Gross parental/family income must not exceed INR 450,000 per year.
- The applicant must not receive another scholarship, fee waiver, or reimbursement covered by the official exclusion.
- The 2025-26 FAQ says a fresh applicant who took a drop after Class XII is not eligible.
- The applicant's identity/demographic details should be consistent across OTR/Aadhaar and the Class XII marksheet. SevaFix checks a normalized name match but never performs Aadhaar authentication.
- One-Time Registration is required to apply through NSP. SevaFix records only whether OTR is ready and must not store an Aadhaar or OTR secret.

## Renewal conditions represented by SevaFix

- The applicant must already be a scheme beneficiary eligible for renewal and must submit a renewal application on NSP.
- At least 50 percent marks in the annual examination are required.
- At least 75 percent attendance is required.
- The applicant must not receive a conflicting scholarship or fee reimbursement.
- Total scholarship duration must not exceed five years, subject to the course-specific limits in the official guidelines.
- A changed institution/course remains eligible only when the course is eligible and the institution has a valid AISHE code.
- The guidelines state that indiscipline, criminal-behaviour, or ragging complaints can lead to forfeiture. SevaFix does not attempt to determine this automatically.

## Evidence checklist

Fresh applications:

- Class XII marksheet.
- Family income certificate.
- Category/caste certificate for an applicant claiming a reserved category.
- Disability certificate for an applicant claiming benchmark-disability reservation.
- Admission/institution evidence used by SevaFix to confirm course and institution details.
- Identity evidence used only for a user-controlled consistency check; the official FAQ specifically describes matching Aadhaar/OTR demographics and the Class XII marksheet.

Renewal applications:

- Previous-year marksheet.
- Attendance evidence where requested for the SevaFix pre-check or institute verification.

The official FAQ says copies of uploaded documents may need to be provided to the institute if requested by the Institute Nodal Officer.

## Scholarship rate and duration

- Graduation level, first three years: INR 12,000 per year.
- Post-graduation level: INR 20,000 per year.
- Five-year professional/integrated courses: INR 20,000 per year in years four and five.
- B.Tech/B.E.: INR 12,000 per year for years one through three and INR 20,000 in year four; support is limited to the graduation-level duration.
- Total duration cannot exceed five years, subject to course-specific rules.

Payment is by Direct Benefit Transfer to the beneficiary's savings bank account. Official guidance describes Aadhaar seeding for disbursement and PFMS/NSP status tracking. SevaFix stores only a readiness answer; it does not store a full Aadhaar or bank-account number in this policy workflow.

## Reservation and selection

The official guidelines describe 15 percent of slots for SC, 7.5 percent for ST, 27 percent for OBC, and 5 percent horizontal reservation for students with benchmark disabilities of 40 percent or more. The FAQ also describes gender, stream, category, and state-board allocation. These are selection/allocation rules, not individual pass/fail guarantees, so SevaFix displays them but does not compute selection.

## Application and verification

- Applications are accepted online through NSP; direct applications to the Ministry are not accepted.
- Credentials can be verified using DigiLocker and by the institute followed by the State Nodal Agency.
- The applicant must select the correct course duration and the correct institution/AISHE code.
- Details remain editable until final submission; later correction depends on the official application being marked defective.
- NSP distinguishes a defective application, which can be corrected and resubmitted, from a rejected application, which is disqualified for an eligibility or data problem.
- Application on NSP is free of charge.

## Current-window observation

On 2026-09-19, the NSP scheme card showed the PM-USP CSSS renewal window opening 2026-06-01 and student applications closing 2026-09-30. A separate NSP announcement stated a 2026-10-31 closing date for PM-USP CSSS renewal applications. Because those official live pages conflict, SevaFix must show a warning and link to NSP rather than enforce either deadline as a deterministic rule until an authorized reviewer resolves the conflict.

## Tracking and grievance routes

Application status is checked in the student's NSP account. Payment status can be checked through PFMS. Scheme grievances can be raised through the official NSP grievance facility or the Department of Higher Education route identified by the current official guidance. The guidelines also reference https://pgportal.gov.in/ for grievances.

## Explicit non-automation

SevaFix does not calculate board quota selection, reservation-slot allocation, institutional verification, State Nodal Agency verification, final eligibility, or payment sanction. It never logs into NSP, solves CAPTCHA, performs Aadhaar authentication, or submits on a citizen's behalf.
