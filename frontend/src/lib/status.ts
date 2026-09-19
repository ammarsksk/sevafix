// Friendly copy + color treatment for backend status/state enums.
// Keeps internal terminology out of the UI per the frontend handoff (section 10).

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface ChipSpec {
  label: string;
  tone: ChipTone;
}

const toneClasses: Record<ChipTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-300",
  info: "bg-blue-50 text-blue-700 border-blue-300",
  success: "bg-emerald-50 text-emerald-700 border-emerald-300",
  warning: "bg-amber-50 text-amber-800 border-amber-300",
  danger: "bg-red-50 text-red-700 border-red-300",
};

export function chipClassName(tone: ChipTone): string {
  return `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`;
}

const lifecycleMap: Record<string, ChipSpec> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ACTION_REQUIRED: { label: "Action required", tone: "warning" },
  READY_WITH_SEVAFIX_CHECKS: { label: "Ready (SevaFix checks)", tone: "success" },
  REPAIR_DRAFT: { label: "Repair in progress", tone: "warning" },
  SUBMITTED: { label: "Submitted", tone: "info" },
};

const documentStateMap: Record<string, ChipSpec> = {
  PENDING_UPLOAD: { label: "Waiting for upload", tone: "neutral" },
  SCANNING: { label: "Scanning", tone: "info" },
  SCAN_CLEAN: { label: "Scan clean", tone: "success" },
  QUARANTINED: { label: "Quarantined", tone: "danger" },
  UPLOADED: { label: "Uploaded", tone: "info" },
  OCR_RUNNING: { label: "Reading document", tone: "info" },
  EXTRACTED: { label: "Extracted", tone: "success" },
  NEEDS_USER_CONFIRMATION: { label: "Needs your confirmation", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  UNSUPPORTED_LANGUAGE: { label: "Unsupported language", tone: "danger" },
  OCR_FAILED_RETRYABLE: { label: "Reading failed — retry", tone: "warning" },
  OCR_FAILED_FINAL: { label: "Reading failed", tone: "danger" },
  DELETED: { label: "Deleted", tone: "neutral" },
};

const checkStatusMap: Record<string, ChipSpec> = {
  PASS: { label: "Pass", tone: "success" },
  FAIL: { label: "Needs fixing", tone: "danger" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
  NOT_APPLICABLE: { label: "Not applicable", tone: "neutral" },
  BLOCKED_MISSING_EVIDENCE: { label: "Missing evidence", tone: "warning" },
  BLOCKED_SOURCE_STALE: { label: "Policy source outdated", tone: "warning" },
};

const jobStatusMap: Record<string, ChipSpec> = {
  QUEUED: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

const readinessMap: Record<string, ChipSpec> = {
  READY_WITH_SEVAFIX_CHECKS: { label: "Ready (SevaFix checks)", tone: "success" },
  ACTION_REQUIRED: { label: "Action required", tone: "warning" },
};

const reviewStateMap: Record<string, ChipSpec> = {
  CHANGED: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

function lookup(map: Record<string, ChipSpec>, value: string): ChipSpec {
  return map[value] ?? { label: value.replaceAll("_", " ").toLowerCase(), tone: "neutral" };
}

export const lifecycleChip = (value: string) => lookup(lifecycleMap, value);
export const documentStateChip = (value: string) => lookup(documentStateMap, value);
export const checkStatusChip = (value: string) => lookup(checkStatusMap, value);
export const jobStatusChip = (value: string) => lookup(jobStatusMap, value);
export const readinessChip = (value: string) => lookup(readinessMap, value);
export const reviewStateChip = (value: string) => lookup(reviewStateMap, value);
