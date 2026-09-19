"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Card, ErrorBanner, FullPageSpinner } from "@/components/ui";
import { REJECTION_DOCUMENT_TYPE } from "@/lib/sevafix/pm-usp-schema";
import { uploadDocument } from "@/lib/sevafix/document-upload";
import { useApplication, useCreateRepair, useDiagnose, useValidate } from "@/lib/sevafix/queries";
import { waitForJob } from "@/lib/sevafix/sevafix-api";
import type { Diagnosis } from "@/lib/sevafix/sevafix-types";

const POLL_TIMEOUT_MS = 90_000;
const READY_DOCUMENT_STATES = new Set(["EXTRACTED", "NEEDS_USER_CONFIRMATION", "CONFIRMED"]);
const PENDING_DOCUMENT_STATES = new Set(["PENDING_UPLOAD", "SCANNING", "SCAN_CLEAN", "UPLOADED", "OCR_RUNNING"]);

export default function DiagnosePage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const router = useRouter();
  const application = useApplication(appId);
  const diagnose = useDiagnose(appId);
  const validate = useValidate(appId);
  const createRepair = useCreateRepair(appId);

  const [reasonText, setReasonText] = useState<string | null>(null);
  const [rejectionDocumentId, setRejectionDocumentId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestDiagnosis, setLatestDiagnosis] = useState<Diagnosis | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const documents = useMemo(() => application.data?.documents ?? [], [application.data?.documents]);
  const diagnoses = [...(application.data?.diagnoses ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!documents.some((document) => PENDING_DOCUMENT_STATES.has(document.state))) return;
    const timer = window.setInterval(() => void application.refetch(), 3000);
    return () => window.clearInterval(timer);
  }, [documents, application]);

  async function onUploadRejectionNotice(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { session } = await uploadDocument(appId, REJECTION_DOCUMENT_TYPE, file);
      setRejectionDocumentId(session.documentId);
      await application.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDiagnose() {
    setError(null);
    const effectiveReason = reasonText ?? application.data?.application.initialGrievanceReason ?? "";
    const selectedDocument = documents.find((document) => document.documentId === rejectionDocumentId);
    if (rejectionDocumentId && selectedDocument && !READY_DOCUMENT_STATES.has(selectedDocument.state)) {
      setError("The rejection notice is still being processed. Wait for document reading to finish, or enter the rejection reason as text.");
      return;
    }
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    setRunning(true);
    try {
      if (!effectiveReason && !rejectionDocumentId) {
        const validationJob = await validate.mutateAsync();
        await waitForJob(validationJob.jobId, { timeoutMs: POLL_TIMEOUT_MS, signal: controllerRef.current.signal });
        await application.refetch();
      }
      const job = await diagnose.mutateAsync({
        reasonText: effectiveReason || undefined,
        rejectionDocumentId: rejectionDocumentId || undefined,
      });
      await waitForJob(job.jobId, { timeoutMs: POLL_TIMEOUT_MS, signal: controllerRef.current.signal });
      const refreshed = await application.refetch();
      const sorted = [...(refreshed.data?.diagnoses ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setLatestDiagnosis(sorted[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run diagnosis");
    } finally {
      setRunning(false);
    }
  }

  async function onCreateRepair(diagnosisId?: string) {
    setError(null);
    try {
      await createRepair.mutateAsync(diagnosisId);
      router.push(`/applications/${appId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create repair draft");
    }
  }

  const shown = latestDiagnosis ?? diagnoses[0] ?? null;

  if (application.isLoading) return <FullPageSpinner />;
  if (!application.data) return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;

  return (
    <div className="space-y-6">
      {application.data.application.sourceApplication ? (
        <Card className="border-orange-200 bg-orange-50">
          <h2 className="text-sm font-semibold text-orange-900">Grievance diagnosis</h2>
          <p className="mt-1 text-sm text-orange-800">
            Add the rejection notice below. For a stronger comparison, also upload the form and evidence you originally submitted on the{" "}
            <Link className="font-medium underline" href={`/applications/${appId}/documents`}>Documents tab</Link>.
          </p>
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Diagnose a rejection</h2>
        <ErrorBanner message={error} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Rejection reason, if available</span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            rows={4}
            value={reasonText ?? application.data.application.initialGrievanceReason ?? ""}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Optional — leave blank to infer likely issues from the application checks"
          />
        </label>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-medium text-slate-800">Rejection notice document</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rejectionDocumentId}
              onChange={(e) => setRejectionDocumentId(e.target.value)}
            >
              <option value="">None</option>
              {documents.map((doc) => (
                <option key={doc.documentId} value={doc.documentId}>
                  {doc.documentType} ({doc.state})
                </option>
              ))}
            </select>
            <label>
              <span
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 ${
                  uploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {uploading ? "Uploading…" : "Upload rejection notice"}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                disabled={uploading}
                onChange={(e) => onUploadRejectionNotice(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <Button className="mt-4" onClick={onDiagnose} loading={running}>
          Diagnose
        </Button>
      </Card>

      {shown ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Latest diagnosis</h2>
          <p className="text-sm font-medium text-slate-900">
            {shown.result.category.replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-sm text-slate-600">{shown.result.summary}</p>
          {shown.result.diagnosisBasis === "INFERRED_FROM_CHECKS" ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Likely issue inferred from the application and scheme checks. This is not an official rejection reason from the authority.
            </p>
          ) : null}
          {shown.result.recommendedActions.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
              {shown.result.recommendedActions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          ) : null}
          {shown.result.usedModelId ? <p className="mt-2 text-xs text-blue-700">AI-assisted with {shown.result.usedModelId}; verified citations only.</p> : <p className="mt-2 text-xs text-slate-500">Safe deterministic diagnosis</p>}
          {shown.result.citations?.length ? (
            <div className="mt-2 text-xs text-slate-500">
              Sources:{" "}
              {shown.result.citations.map((citation, index) => citation.uri ? (
                <span key={citation.citationId}>{index ? ", " : ""}<a className="underline" href={citation.uri} target="_blank" rel="noopener noreferrer">{citation.citationId}</a></span>
              ) : <span key={citation.citationId}>{index ? ", " : ""}{citation.citationId}</span>)}
            </div>
          ) : null}
          {(application.data.versions.length ?? 0) === 0 ? <p className="mt-3 text-xs text-amber-700">Freeze a version on the Review tab before starting a repair draft.</p> : null}
          <Button
            className="mt-4"
            onClick={() => onCreateRepair(shown.diagnosisId)}
            loading={createRepair.isPending}
            disabled={application.data.versions.length === 0}
          >
            Start corrected application
          </Button>
        </Card>
      ) : null}

      {diagnoses.length > 1 ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Past diagnoses</h2>
          <ul className="space-y-2">
            {diagnoses.slice(1).map((d) => (
              <li key={d.diagnosisId} className="text-sm text-slate-600">
                {new Date(d.createdAt).toLocaleString()} — {d.result.category.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
