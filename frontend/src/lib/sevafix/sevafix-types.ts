export type IsoDateTime = string;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: { retryable?: boolean; [key: string]: unknown };
  };
}

export interface Scheme {
  schemeId: string;
  name: string;
  shortName?: string;
  status: "ACTIVE" | string;
  activePolicyVersionId?: string;
  officialPortalUrl?: string;
  disclaimer?: string;
  updatedAt?: IsoDateTime;
}

export interface UserProfile {
  sub: string;
  profileStatus?: "EMPTY" | string;
  displayName?: string;
  locale?: string;
  notificationEmail?: string;
  notificationOptIn?: boolean;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export type DraftFields = Record<string, string | number | boolean | null>;

export type ApplicationLifecycle =
  | "DRAFT"
  | "ACTION_REQUIRED"
  | "READY_WITH_SEVAFIX_CHECKS"
  | "REPAIR_DRAFT"
  | "SUBMITTED"
  | string;

export interface Application {
  appId: string;
  ownerSub: string;
  schemeId: string;
  journeyType?: "NEW_APPLICATION" | "GRIEVANCE";
  sourceApplication?: "SEVAFIX" | "EXTERNAL";
  initialGrievanceReason?: string;
  grievanceOpenedAt?: IsoDateTime;
  policyVersionId?: string;
  lifecycleStatus: ApplicationLifecycle;
  draftFields: DraftFields;
  revision: number;
  currentVersion: number;
  currentVersionId?: string;
  readinessSummary?: ReadinessSummary;
  lastValidationRunId?: string;
  activeRepairId?: string;
  officialApplicationIdDisplay?: string;
  submittedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ApplicationSummary {
  appId: string;
  schemeId: string;
  journeyType?: "NEW_APPLICATION" | "GRIEVANCE";
  lifecycleStatus: ApplicationLifecycle;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OpenGrievanceInput {
  schemeId: string;
  sourceApplication: "SEVAFIX" | "EXTERNAL";
  rejectionReason?: string;
  existingApplicationId?: string;
  officialApplicationId?: string;
  submittedAt?: string;
}

export interface ApplicationVersion {
  appId: string;
  versionId: string;
  versionNumber: number;
  parentVersionId?: string;
  policyVersionId?: string;
  fields: DraftFields;
  status: "FROZEN" | string;
  createdAt: IsoDateTime;
  createdBy: string;
}

export type DocumentState =
  | "PENDING_UPLOAD"
  | "SCANNING"
  | "SCAN_CLEAN"
  | "QUARANTINED"
  | "UPLOADED"
  | "OCR_RUNNING"
  | "EXTRACTED"
  | "NEEDS_USER_CONFIRMATION"
  | "CONFIRMED"
  | "UNSUPPORTED_LANGUAGE"
  | "OCR_FAILED_RETRYABLE"
  | "OCR_FAILED_FINAL"
  | "DELETED"
  | string;

export interface ExtractedFact<T = unknown> {
  value: T;
  confidence?: number;
  page?: number;
  boundingBox?: { Width: number; Height: number; Left: number; Top: number };
}

export interface DocumentRecord {
  documentId: string;
  appId: string;
  ownerSub: string;
  documentType: string;
  contentType: string;
  declaredSize: number;
  sha256: string;
  state: DocumentState;
  extractedFacts?: Record<string, ExtractedFact>;
  confirmedFacts?: Record<string, unknown>;
  extractedText?: string;
  ocrConfidence?: number;
  ocrFailure?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type CheckStatus =
  | "PASS"
  | "FAIL"
  | "NEEDS_REVIEW"
  | "NOT_APPLICABLE"
  | "BLOCKED_MISSING_EVIDENCE"
  | "BLOCKED_SOURCE_STALE";

export interface CheckResult {
  runId: string;
  ruleId: string;
  status: CheckStatus;
  message: string;
  severity: "BLOCKING" | "ADVISORY" | string;
  actual?: unknown;
  expected?: unknown;
  missingEvidence?: string[];
  sourceRefs?: string[];
  messageKey?: string;
  evaluatedAt: IsoDateTime;
}

export interface ReadinessSummary {
  passed: number;
  applicable: number;
  failed: number;
  needsReview: number;
  blocked: number;
  ready: boolean;
  label: "READY_WITH_SEVAFIX_CHECKS" | "ACTION_REQUIRED";
}

export interface ValidationRun {
  runId: string;
  policyVersionId: string;
  engineVersion: string;
  status: "COMPLETED" | string;
  summary: ReadinessSummary;
  createdAt: IsoDateTime;
}

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  occurredAt: IsoDateTime;
}

export type DiagnosisCategory =
  | "MISSING_DOCUMENT"
  | "INCOME_MISMATCH"
  | "NAME_MISMATCH"
  | "INELIGIBLE_COURSE"
  | "OTHER_SCHOLARSHIP_CONFLICT"
  | "PERCENTILE_NOT_VERIFIED"
  | "APPLICATION_DATA_ERROR"
  | "DEADLINE_OR_PROCESS"
  | "UNKNOWN";

export interface DiagnosisResult {
  category: DiagnosisCategory;
  summary: string;
  recommendedActions: string[];
  confidence: number;
  diagnosisBasis?: "PROVIDED_REASON" | "INFERRED_FROM_CHECKS";
  usedModelId?: string;
  citedSourceIds?: string[];
  citations?: Array<{ citationId: string; uri?: string; score?: number }>;
}

export interface Diagnosis {
  diagnosisId: string;
  applicationId: string;
  policyVersionId: string;
  reasonText: string;
  result: DiagnosisResult;
  status: "COMPLETED" | string;
  modelId: string;
  createdAt: IsoDateTime;
}

export interface RepairCase {
  repairId: string;
  fromVersionId: string;
  diagnosisId?: string;
  status: "OPEN" | string;
  createdAt: IsoDateTime;
  createdBy: string;
}

export interface ApplicationView {
  application: Application;
  documents: DocumentRecord[];
  versions: ApplicationVersion[];
  timeline: TimelineEvent[];
  validationRuns: ValidationRun[];
  checks: CheckResult[];
  diagnoses: Diagnosis[];
  repairs: RepairCase[];
}

export type JobStatus = "QUEUED" | "COMPLETED" | "FAILED" | string;

export interface Job<T = unknown> {
  jobId: string;
  jobType: "VALIDATION" | "DIAGNOSIS" | "USER_DELETION" | string;
  applicationId?: string;
  diagnosisId?: string;
  status: JobStatus;
  result?: T;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UploadSession {
  documentId: string;
  uploadUrl: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export interface ViewUrl {
  viewUrl: string;
  expiresIn: number;
}

export interface SourceChange {
  changeId: string;
  sourceId: string;
  schemeId?: string;
  title?: string;
  sourceUrl?: string;
  snapshotKey: string;
  contentSha256: string;
  reviewState: "CHANGED" | "APPROVED" | "REJECTED" | string;
  detectedAt?: IsoDateTime;
  reviewedAt?: IsoDateTime;
  reviewedBy?: string;
  reviewReason?: string;
}
