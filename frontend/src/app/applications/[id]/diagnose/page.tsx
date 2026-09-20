"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, ErrorBanner, FullPageSpinner, PageHeader } from "@/components/ui";
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

  const latestRunId = application.data.application.lastValidationRunId;
  const supportingCheck = application.data.checks.find((check) =>
    (!latestRunId || check.runId === latestRunId)
    && (check.status === "FAIL" || check.status === "NEEDS_REVIEW" || check.status.startsWith("BLOCKED")),
  );
  const officialReason = reasonText ?? application.data.application.initialGrievanceReason ?? "";
  const latestRepair = [...application.data.repairs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <div>
      <PageHeader eyebrow="Application diagnosis" title="Understand what may have happened" description="Here is what the available evidence suggests. A SevaFix diagnosis is not an official decision or rejection reason." />
      <ErrorBanner message={error} />
      {application.data.application.sourceApplication ? (
        <div className="mb-7 border-l-2 border-[var(--review)] bg-[var(--warning-soft)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Before you run a diagnosis</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-2)]">
            Add the rejection notice below. For a stronger comparison, also upload the form and evidence you originally submitted on the{" "}
            <Link className="font-medium underline" href={`/applications/${appId}/documents`}>Documents tab</Link>.
          </p>
        </div>
      ) : null}
      <section className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 py-6 sm:px-7">
        <h2 className="font-display text-2xl text-[var(--ink)]">Add the authority&apos;s information</h2>
        <p className="mt-1 text-sm text-[var(--ink-2)]">Use the exact reason shown on the portal or rejection notice when available.</p>
        <label className="block">
          <span className="mb-1 mt-5 block text-sm font-semibold text-[var(--ink)]">Official reason, if provided</span>
          <textarea
            className="w-full rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2 text-sm"
            rows={4}
            value={reasonText ?? application.data.application.initialGrievanceReason ?? ""}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Optional — leave blank to infer likely issues from the application checks"
          />
        </label>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-semibold text-[var(--ink)]">Rejection notice document</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2 text-sm"
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
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:border-[var(--accent)] ${
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

        <Button className="mt-5" onClick={onDiagnose} loading={running}>
          Review available evidence
        </Button>
      </section>

      {shown ? (
        <section className="mt-10">
          <div className="border border-[var(--rule-strong)] bg-[var(--sheet)]">
            {officialReason ? <div className="border-b border-[var(--rule)] px-5 py-5 sm:px-7"><p className="eyebrow">Official reason · supplied by authority</p><p className="mt-2 text-sm leading-6 text-[var(--ink)]">{officialReason}</p></div> : <div className="border-b border-[var(--rule)] bg-[var(--warning-soft)] px-5 py-4 sm:px-7"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--review)]">Inferred from available evidence</p><p className="mt-2 text-sm text-[var(--ink-2)]">The authority did not provide a reason. The issue below is a SevaFix inference, not an official rejection reason.</p></div>}
            <div className="px-5 py-7 sm:px-7">
              <p className="eyebrow">Likely issue</p>
              <h2 className="mt-3 font-display text-3xl text-[var(--ink)]">{shown.result.category.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--ink-2)]">{shown.result.summary}</p>
              <div className="mt-6 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Evidence status</p><p className="mt-2 text-sm text-[var(--ink)]">{supportingCheck ? "Supported by an application check and available uploaded evidence." : "Based on the available reason and reviewed policy evidence."}</p></div>
            </div>

            <dl className="grid border-t border-[var(--rule)] sm:grid-cols-3">
              <div className="border-b border-[var(--rule)] p-5 sm:border-b-0 sm:border-r"><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Application value</dt><dd className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{supportingCheck?.actual === undefined ? "Not returned" : JSON.stringify(supportingCheck.actual)}</dd></div>
              <div className="border-b border-[var(--rule)] p-5 sm:border-b-0 sm:border-r"><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Expected or document value</dt><dd className="mt-2 break-words text-sm font-semibold text-[var(--ink)]">{supportingCheck?.expected === undefined ? "Not returned" : JSON.stringify(supportingCheck.expected)}</dd></div>
              <div className="p-5"><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Policy reference</dt><dd className="mt-2 text-sm font-semibold text-[var(--ink)]">{shown.policyVersionId}</dd></div>
            </dl>

            <div className="border-t border-[var(--rule)] px-5 py-6 sm:px-7"><p className="eyebrow">Next step</p>{shown.result.recommendedActions.length ? <ol className="mt-3 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">{shown.result.recommendedActions.map((action, index) => <li key={index} className="flex gap-3 py-3 text-sm text-[var(--ink)]"><span className="font-mono text-xs text-[var(--ink-2)]">{String(index + 1).padStart(2, "0")}</span>{action}</li>)}</ol> : <p className="mt-2 text-sm text-[var(--ink-2)]">No corrective action was returned.</p>}</div>
          </div>

          <div className="mt-8"><p className="eyebrow">Sources</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Evidence attached to this diagnosis</h2>{shown.result.citations?.length ? <div className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule-strong)] bg-[var(--sheet)]">{shown.result.citations.map((citation) => <div key={citation.citationId} className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-7"><div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Source</p><p className="mt-2 text-sm font-semibold text-[var(--ink)]">{citation.citationId}</p><p className="mt-1 text-xs text-[var(--ink-2)]">Authority and relevant passage are not included in the current source response. Policy version: {shown.policyVersionId}.</p></div>{citation.uri ? <a href={citation.uri} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline">Open official source ↗</a> : <span className="text-xs text-[var(--ink-2)]">No public link returned</span>}</div>)}</div> : <div className="mt-4 border-y border-dashed border-[var(--rule-strong)] py-6 text-sm text-[var(--ink-2)]">No source links were returned with this diagnosis.</div>}</div>

          {latestRepair ? <div className="mt-8 border-y border-[var(--rule-strong)] py-6"><p className="eyebrow">Repair relationship</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Original preserved. Correction open.</h2><div className="mt-5 grid border-y border-[var(--rule)] sm:grid-cols-2"><div className="border-b border-[var(--rule)] p-4 sm:border-b-0 sm:border-r"><p className="font-mono text-[11px] uppercase text-[var(--ink-2)]">Frozen source version</p><p className="mt-2 font-mono text-sm text-[var(--ink)]">{latestRepair.fromVersionId}</p></div><div className="p-4"><p className="font-mono text-[11px] uppercase text-[var(--ink-2)]">Correction case · {latestRepair.status}</p><p className="mt-2 font-mono text-sm text-[var(--ink)]">{latestRepair.repairId}</p></div></div><p className="mt-4 text-sm text-[var(--ink-2)]">The correction draft can change; the frozen source version cannot.</p><Link href={`/applications/${appId}/edit`} className="mt-4 inline-flex min-h-11 items-center border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">Continue corrected version</Link></div> : <div className="mt-8 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-5"><p className="font-semibold text-[var(--ink)]">Create a corrected version</p><p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">This creates a new working version. Your original application and frozen submission version remain unchanged.</p>{application.data.versions.length === 0 ? <p className="mt-3 text-sm font-semibold text-[var(--review)]">Create a submission version under Review before starting a repair.</p> : null}<Button className="mt-4" onClick={() => onCreateRepair(shown.diagnosisId)} loading={createRepair.isPending} disabled={application.data.versions.length === 0}>Create corrected version</Button></div>}
          <p className="mt-4 font-mono text-[11px] text-[var(--ink-2)]">{shown.result.usedModelId ? "Plain-language explanation supported by verified citations and deterministic checks." : "Deterministic fallback used; no model-generated explanation was required."}</p>
        </section>
      ) : null}

      {diagnoses.length > 1 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-[var(--ink)]">Past diagnoses</h2>
          <ul className="mt-3 divide-y divide-[var(--rule)] border-y border-[var(--rule-strong)] px-5">
            {diagnoses.slice(1).map((d) => (
              <li key={d.diagnosisId} className="py-3 text-sm text-[var(--ink-2)]">
                {new Date(d.createdAt).toLocaleString()} — {d.result.category.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
