import { fetchAuthSession } from "aws-amplify/auth";

import type {
  ApiErrorBody,
  Application,
  ApplicationSummary,
  ApplicationVersion,
  ApplicationView,
  DiagnosisResult,
  DocumentRecord,
  DraftFields,
  Job,
  OpenGrievanceInput,
  RepairCase,
  Scheme,
  SourceChange,
  TimelineEvent,
  UploadSession,
  UserProfile,
  ViewUrl,
} from "./sevafix-types";

const API_URL = (process.env.NEXT_PUBLIC_SEVAFIX_API_URL ?? "").replace(/\/$/, "");

export class SevaFixApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly correlationId?: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "SevaFixApiError";
  }
}

async function idToken(): Promise<string> {
  const { tokens } = await fetchAuthSession();
  const token = tokens?.idToken?.toString();
  if (!token) throw new Error("No authenticated Cognito ID token is available");
  return token;
}

async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_SEVAFIX_API_URL is not configured");

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (authenticated) headers.set("Authorization", `Bearer ${await idToken()}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const responseText = response.status === 204 ? "" : await response.text();
  let payload: unknown;
  try {
    payload = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const failure = payload as ApiErrorBody | undefined;
    throw new SevaFixApiError(
      failure?.error?.message ?? `Request failed with HTTP ${response.status}`,
      response.status,
      failure?.error?.code ?? "HTTP_ERROR",
      failure?.error?.correlationId,
      Boolean(failure?.error?.details?.retryable),
    );
  }
  return payload as T;
}

const json = (value: unknown): string => JSON.stringify(value);

export const sevaFixApi = {
  health: () => api<{ status: string; service: string; environment: string }>("/health", {}, false),

  me: () => api<UserProfile>("/me"),
  updateMe: (
    body: Partial<
      Pick<
        UserProfile,
        "displayName" | "governmentName" | "locale" | "notificationEmail" | "notificationOptIn"
      >
    >,
  ) =>
    api<UserProfile>("/me", { method: "PATCH", body: json(body) }),
  schemes: () => api<{ items: Scheme[] }>("/schemes"),
  scheme: (schemeId: string) => api<Scheme>(`/schemes/${encodeURIComponent(schemeId)}`),

  applications: () => api<{ items: ApplicationSummary[] }>("/applications"),
  createApplication: (schemeId: string) =>
    api<Application>("/applications", { method: "POST", body: json({ schemeId }) }),
  openGrievance: (body: OpenGrievanceInput) =>
    api<Application>("/grievances", { method: "POST", body: json(body) }),
  application: (appId: string) =>
    api<ApplicationView>(`/applications/${encodeURIComponent(appId)}`),
  saveDraft: (appId: string, fields: DraftFields, expectedRevision: number) =>
    api<Application>(`/applications/${encodeURIComponent(appId)}/draft`, {
      method: "PATCH",
      body: json({ fields, expectedRevision }),
    }),
  freezeVersion: (appId: string) =>
    api<ApplicationVersion>(`/applications/${encodeURIComponent(appId)}/versions`, {
      method: "POST",
      body: "{}",
    }),
  validate: (appId: string) =>
    api<Job>(`/applications/${encodeURIComponent(appId)}/validate`, {
      method: "POST",
      body: "{}",
    }),

  createUpload: (body: {
    applicationId: string;
    documentType: string;
    contentType: string;
    size: number;
    sha256: string;
  }) => api<UploadSession>("/documents/uploads", { method: "POST", body: json(body) }),
  completeUpload: (documentId: string) =>
    api<DocumentRecord>(`/documents/${encodeURIComponent(documentId)}/complete`, {
      method: "POST",
      body: "{}",
    }),
  confirmDocumentFacts: (appId: string, documentId: string, facts: Record<string, unknown>) =>
    api<DocumentRecord>(
      `/applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(documentId)}/facts`,
      { method: "PATCH", body: json({ facts }) },
    ),
  documentViewUrl: (documentId: string) =>
    api<ViewUrl>(`/documents/${encodeURIComponent(documentId)}/view-url`, {
      method: "POST",
      body: "{}",
    }),
  deleteDocument: (documentId: string) =>
    api<DocumentRecord>(`/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" }),

  job: <T = unknown>(jobId: string) => api<Job<T>>(`/jobs/${encodeURIComponent(jobId)}`),
  recordSubmission: (appId: string, officialApplicationId: string, submittedAt: string) =>
    api<Application>(`/applications/${encodeURIComponent(appId)}/official-submission`, {
      method: "POST",
      body: json({ officialApplicationId, submittedAt }),
    }),
  addTimelineEvent: (
    appId: string,
    eventType: string,
    payload: Record<string, unknown> = {},
    occurredAt?: string,
  ) =>
    api<TimelineEvent>(`/applications/${encodeURIComponent(appId)}/timeline-events`, {
      method: "POST",
      body: json({ eventType, payload, ...(occurredAt ? { occurredAt } : {}) }),
    }),
  diagnose: (appId: string, body: { reasonText?: string; rejectionDocumentId?: string }) =>
    api<Job<DiagnosisResult>>(`/applications/${encodeURIComponent(appId)}/diagnoses`, {
      method: "POST",
      body: json(body),
    }),
  createRepair: (appId: string, diagnosisId?: string) =>
    api<RepairCase>(`/applications/${encodeURIComponent(appId)}/repairs`, {
      method: "POST",
      body: json(diagnosisId ? { diagnosisId } : {}),
    }),
  requestAccountDeletion: () =>
    api<Job>("/me/deletion", { method: "POST", body: "{}" }),

  sourceChanges: () => api<{ items: SourceChange[] }>("/review/source-changes"),
  sourceChange: (changeId: string) =>
    api<SourceChange>(`/review/source-changes/${encodeURIComponent(changeId)}`),
  approveSourceChange: (changeId: string) =>
    api<SourceChange>(`/review/source-changes/${encodeURIComponent(changeId)}/approve`, {
      method: "POST",
      body: "{}",
    }),
  rejectSourceChange: (changeId: string, reason: string) =>
    api<SourceChange>(`/review/source-changes/${encodeURIComponent(changeId)}/reject`, {
      method: "POST",
      body: json({ reason }),
    }),
  publishPolicy: (versionId: string, body: Record<string, unknown>) =>
    api<{ policy: Record<string, unknown>; ruleCount: number; ingestionJobId?: string }>(
      `/review/policy-versions/${encodeURIComponent(versionId)}/publish`,
      { method: "POST", body: json(body) },
    ),
  rollbackPolicy: (
    versionId: string,
    schemeId: string,
    auditReason: string,
  ) =>
    api<{ schemeId: string; activePolicyVersionId: string; updatedAt: string }>(
      `/review/policy-versions/${encodeURIComponent(versionId)}/rollback-pointer`,
      {
        method: "POST",
        body: json({ schemeId, auditReason, confirmation: "ROLLBACK" }),
      },
    ),
};

export async function waitForJob<T = unknown>(
  jobId: string,
  options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Job<T>> {
  const intervalMs = options.intervalMs ?? 2_000;
  const deadline = Date.now() + (options.timeoutMs ?? 120_000);
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    const job = await sevaFixApi.job<T>(jobId);
    if (job.status === "COMPLETED") return job;
    if (job.status === "FAILED") throw new Error(`SevaFix job ${jobId} failed`);
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs);
      options.signal?.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
  throw new Error(`Timed out waiting for SevaFix job ${jobId}`);
}
