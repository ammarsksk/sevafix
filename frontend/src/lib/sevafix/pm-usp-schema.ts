import type { DraftFields } from "./sevafix-types";

// Mirrors backend/data/pm-usp-csss-2026-27.3/manifest.json.
// Keep this version-pinned until the backend exposes a dynamic form-schema endpoint.
export type FieldType = "text" | "integer" | "number" | "select" | "boolean";
export type ApplicationType = "FRESH" | "RENEWAL";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  section: "application" | "student" | "course";
  helpText?: string;
  options?: FieldOption[];
  required?: boolean;
  requiredFor?: ApplicationType[];
  minimum?: number;
  maximum?: number;
}

export const PM_USP_SCHEME_ID = "pm-usp-csss";

const options = (values: string[]): FieldOption[] =>
  values.map((value) => ({
    value,
    label: value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase()),
  }));

export const PM_USP_SECTIONS = [
  { id: "application", title: "Application type" },
  { id: "student", title: "Student details" },
  { id: "course", title: "Course and institution" },
] as const;

export const PM_USP_FIELDS: FieldConfig[] = [
  { key: "application.type", label: "Application type", type: "select", section: "application", required: true, options: options(["FRESH", "RENEWAL"]) },
  { key: "student.primaryName", label: "Name as on Class XII marksheet", type: "text", section: "student", required: true, helpText: "Enter the name exactly as it appears on official evidence." },
  { key: "student.familyAnnualIncomeINR", label: "Gross annual family income (INR)", type: "integer", section: "student", requiredFor: ["FRESH"], minimum: 0 },
  { key: "student.boardPercentile", label: "Class XII board percentile", type: "number", section: "student", requiredFor: ["FRESH"], minimum: 0, maximum: 100 },
  { key: "student.hasAcademicGap", label: "Took a drop after Class XII", type: "boolean", section: "student", requiredFor: ["FRESH"] },
  { key: "student.receivesOtherScholarship", label: "Receiving another scholarship, fee waiver, or reimbursement", type: "boolean", section: "student", required: true },
  { key: "student.hasOtr", label: "NSP One-Time Registration is ready", type: "boolean", section: "student", required: true },
  { key: "student.category", label: "Category", type: "select", section: "student", required: true, options: options(["GENERAL", "OBC", "SC", "ST", "OTHER"]) },
  { key: "student.hasBenchmarkDisability", label: "Claiming benchmark-disability reservation", type: "boolean", section: "student", required: true },
  { key: "student.disabilityPercentage", label: "Disability percentage", type: "number", section: "student", minimum: 0, maximum: 100 },
  { key: "student.previousYearMarksPercent", label: "Previous annual examination marks (%)", type: "number", section: "student", requiredFor: ["RENEWAL"], minimum: 0, maximum: 100 },
  { key: "student.attendancePercent", label: "Previous-year attendance (%)", type: "number", section: "student", requiredFor: ["RENEWAL"], minimum: 0, maximum: 100 },
  { key: "student.receivedFreshScholarship", label: "Previously selected as a PM-USP CSSS beneficiary", type: "boolean", section: "student", requiredFor: ["RENEWAL"] },
  { key: "student.scholarshipYear", label: "Current scholarship year", type: "integer", section: "student", requiredFor: ["RENEWAL"], minimum: 2, maximum: 5 },
  { key: "student.bankAadhaarSeeded", label: "Bank account is ready for DBT as required by official guidance", type: "boolean", section: "student", required: true, helpText: "Store only yes/no. Never enter an Aadhaar or bank-account number in SevaFix." },
  { key: "student.enrolmentMode", label: "Enrolment mode", type: "select", section: "course", required: true, options: options(["REGULAR", "DISTANCE", "CORRESPONDENCE"]) },
  { key: "student.courseType", label: "Course type", type: "select", section: "course", required: true, options: options(["DEGREE", "BTECH_BE", "PROFESSIONAL_INTEGRATED", "POSTGRADUATE", "DIPLOMA"]) },
  { key: "student.courseYear", label: "Current course year", type: "integer", section: "course", required: true, minimum: 1, maximum: 5 },
  { key: "institution.name", label: "Institution name", type: "text", section: "course", required: true },
  { key: "institution.aisheCode", label: "AISHE code", type: "text", section: "course", required: true },
  { key: "institution.recognized", label: "Recognized by the relevant regulatory body", type: "boolean", section: "course", required: true },
  { key: "institution.aisheActive", label: "Institution status is active on AISHE", type: "boolean", section: "course", required: true },
];

const FRESH_EVIDENCE_TYPES = [
  { value: "MARKSHEET", label: "Class XII marksheet", required: true },
  { value: "INCOME_CERTIFICATE", label: "Family income certificate", required: true },
  { value: "ADMISSION_LETTER", label: "Admission/course/institution evidence", required: true },
  { value: "IDENTITY_PROOF", label: "Identity evidence for consistency check", required: true },
];

const RENEWAL_EVIDENCE_TYPES = [
  { value: "PREVIOUS_YEAR_MARKSHEET", label: "Previous-year marksheet", required: true },
  { value: "ATTENDANCE_CERTIFICATE", label: "Attendance evidence", required: true },
  { value: "ADMISSION_LETTER", label: "Current course/institution evidence", required: true },
  { value: "IDENTITY_PROOF", label: "Identity evidence for consistency check", required: true },
];

export function evidenceTypesFor(fields: DraftFields) {
  const applicationType = fields["application.type"];
  const result = applicationType === "RENEWAL" ? [...RENEWAL_EVIDENCE_TYPES] : [...FRESH_EVIDENCE_TYPES];
  if (applicationType === "FRESH" && fields["student.category"] && fields["student.category"] !== "GENERAL") {
    result.push({ value: "CATEGORY_CERTIFICATE", label: "Category/caste certificate", required: true });
  }
  if (applicationType === "FRESH" && fields["student.hasBenchmarkDisability"] === true) {
    result.push({ value: "DISABILITY_CERTIFICATE", label: "Disability certificate", required: true });
  }
  return result;
}

export const REJECTION_DOCUMENT_TYPE = "REJECTION_NOTICE";
