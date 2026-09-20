"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/icons";
import { Button, ConfirmModal, ErrorBanner, FullPageSpinner, PageHeader, StatusChip, TextField } from "@/components/ui";
import { uploadDocument } from "@/lib/sevafix/document-upload";
import { evidenceTypesForScheme } from "@/lib/sevafix/scheme-schema";
import { useApplication, useConfirmDocumentFacts, useDeleteDocument, useScheme } from "@/lib/sevafix/queries";
import { sevaFixApi } from "@/lib/sevafix/sevafix-api";
import type { DocumentRecord } from "@/lib/sevafix/sevafix-types";
import { documentStateChip } from "@/lib/status";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
const NON_TERMINAL_STATES = new Set(["PENDING_UPLOAD", "SCANNING", "SCAN_CLEAN", "UPLOADED", "OCR_RUNNING"]);
const DOCUMENT_PROGRESS: Record<string, number> = { PENDING_UPLOAD: 8, SCANNING: 26, SCAN_CLEAN: 42, UPLOADED: 52, OCR_RUNNING: 72, EXTRACTED: 88, NEEDS_USER_CONFIRMATION: 92, CONFIRMED: 100, OCR_FAILED_FINAL: 100, UNSUPPORTED_LANGUAGE: 100 };

const formatLabel = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

function FactConfirmationForm({ appId, doc }: { appId: string; doc: DocumentRecord }) {
  const confirmFacts = useConfirmDocumentFacts(appId);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(doc.extractedFacts ?? {}).map(([key, fact]) => [key, String(fact.value ?? "")])));
  const [error, setError] = useState<string | null>(null);
  const entries = Object.entries(doc.extractedFacts ?? {});

  function confirmedValue(key: string, value: string): string | number {
    if (key === "annualIncomeINR") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  }

  async function onSubmit() {
    setError(null);
    try {
      const facts = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { ...(doc.extractedFacts?.[key] ?? {}), value: confirmedValue(key, value), confidence: 100 }]));
      await confirmFacts.mutateAsync({ documentId: doc.documentId, facts });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the extracted information");
    }
  }

  if (entries.length === 0) return <p className="text-sm text-[var(--review)]">No extracted values were returned. Upload a clearer original file if possible.</p>;

  return (
    <div className="border-l-2 border-[var(--review)] bg-[var(--warning-soft)] p-5">
      <p className="font-semibold text-[var(--ink)]">Confirm the information read from this document</p>
      <p className="mt-1 text-sm text-[var(--ink-2)]">Highlighted text remains a suggestion until you confirm it.</p>
      <ErrorBanner message={error} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {entries.map(([key, fact]) => (
          <div key={key}>
            <TextField label={formatLabel(key)} value={values[key] ?? ""} onChange={(event) => setValues((previous) => ({ ...previous, [key]: event.target.value }))} />
            {typeof fact.confidence === "number" && fact.confidence < 98 ? <p className="mt-1 inline bg-[var(--evidence)] px-1 text-xs font-semibold text-[var(--ink)] underline decoration-[var(--review)] decoration-wavy underline-offset-2">Needs confirmation · {fact.confidence.toFixed(0)}% reading confidence</p> : null}
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={onSubmit} loading={confirmFacts.isPending}>Confirm extracted information</Button>
    </div>
  );
}
function DocumentRow({ appId, doc }: { appId: string; doc: DocumentRecord }) {
  const deleteDocument = useDeleteDocument(appId);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const extracted = Object.entries(doc.confirmedFacts ?? doc.extractedFacts ?? {}).slice(0, 2);
  const progress = DOCUMENT_PROGRESS[doc.state] ?? 0;

  async function onView() {
    setViewError(null);
    setViewing(true);
    try {
      const { viewUrl } = await sevaFixApi.documentViewUrl(doc.documentId);
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Could not open this document");
    } finally {
      setViewing(false);
    }
  }

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteDocument.mutateAsync(doc.documentId);
      setConfirmingDelete(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this document");
    }
  }

  return (
    <>
      <tr className="border-b border-[var(--rule)] align-top">
        <td className="px-4 py-4"><p className="font-semibold text-[var(--ink)]">{formatLabel(doc.documentType)}</p><p className="mt-1 font-mono text-xs text-[var(--ink-2)]">{(doc.declaredSize / 1024).toFixed(0)} KB · {doc.contentType}</p></td>
        <td className="px-4 py-4"><StatusChip spec={documentStateChip(doc.state)} /><div className="mt-3 h-px w-28 bg-[var(--rule)]"><div className={`h-px ${doc.state === "OCR_FAILED_FINAL" || doc.state === "UNSUPPORTED_LANGUAGE" ? "bg-[var(--fail)]" : "bg-[var(--accent)]"}`} style={{ width: `${progress}%` }} /></div>{doc.state === "OCR_RUNNING" ? <p className="mt-2 text-xs text-[var(--ink-2)]">Reading the document…</p> : null}</td>
        <td className="px-4 py-4 text-sm text-[var(--ink-2)]">{extracted.length ? extracted.map(([key, fact]) => <p key={key}><span className="font-semibold text-[var(--ink)]">{formatLabel(key)}:</span> {String(typeof fact === "object" && fact && "value" in fact ? fact.value : fact)}</p>) : "No extracted information yet"}</td>
        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-[var(--ink-2)]">{new Date(doc.updatedAt).toLocaleDateString()}</td>
        <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onView} loading={viewing}>View</Button><Button variant="ghost" onClick={() => setConfirmingDelete(true)}>Delete</Button></div></td>
      </tr>
      {(viewError || deleteError || doc.state === "NEEDS_USER_CONFIRMATION" || doc.state === "OCR_FAILED_FINAL" || doc.state === "UNSUPPORTED_LANGUAGE") ? (
        <tr className="border-b border-[var(--rule)]"><td colSpan={5} className="px-4 py-4"><ErrorBanner message={viewError} /><ErrorBanner message={deleteError} />{doc.state === "NEEDS_USER_CONFIRMATION" ? <FactConfirmationForm appId={appId} doc={doc} /> : null}{doc.state === "OCR_FAILED_FINAL" || doc.state === "UNSUPPORTED_LANGUAGE" ? <div className="border-l-2 border-[var(--fail)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--fail)]"><p className="font-semibold">We could not process this document.</p><p className="mt-1">{doc.ocrFailure ?? "Try uploading the original PDF or a clearer scan."}</p></div> : null}</td></tr>
      ) : null}
      {confirmingDelete ? <ConfirmModal title="Delete this document?" description="This removes the document from this application. Upload it again if you need it later." confirmLabel="Delete document" danger onConfirm={onDelete} onClose={() => setConfirmingDelete(false)} busy={deleteDocument.isPending} /> : null}
    </>
  );
}

function UploadRow({ appId, documentType, label, uploaded, onUploaded }: { appId: string; documentType: string; label: string; uploaded: boolean; onUploaded: () => Promise<unknown> }) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) return setError("Use a PDF, JPEG, PNG, or TIFF file.");
    if (file.size > MAX_SIZE_BYTES) return setError("This file is larger than the 10 MiB limit.");
    setUploading(true);
    try { await uploadDocument(appId, documentType, file); await onUploaded(); }
    catch (err) { setError(err instanceof Error ? err.message : "We could not upload this document. Try again."); }
    finally { setUploading(false); }
  }

  return (
    <div className="grid gap-3 border-b border-[var(--rule)] py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><p className="text-sm font-semibold text-[var(--ink)]">{label}</p><p className="mt-1 text-xs text-[var(--ink-2)]">{uploaded ? "A document of this type is already in the application." : "PDF or clear scan · maximum 10 MiB"}</p><ErrorBanner message={error} /></div>
      <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-4 text-sm font-semibold text-[var(--accent)] hover:border-[var(--accent)] ${uploading ? "pointer-events-none opacity-60" : ""}`}><AppIcon name="upload" size={16} />{uploading ? "Uploading…" : uploaded ? "Add another" : "Choose file"}<input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" disabled={uploading} onChange={(event) => void onFileSelected(event.target.files?.[0])} /></label>
    </div>
  );
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const scheme = useScheme(application.data?.application.schemeId ?? "");

  useEffect(() => {
    if (!application.data?.documents.some((document) => NON_TERMINAL_STATES.has(document.state))) return;
    const interval = window.setInterval(() => void application.refetch(), 3000);
    return () => window.clearInterval(interval);
  }, [application]);

  if (application.isLoading || (application.data && scheme.isLoading)) return <FullPageSpinner label="Loading documents…" />;
  if (!application.data) return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;
  if (!scheme.data) return <ErrorBanner message={scheme.error instanceof Error ? scheme.error.message : "Scheme workflow not found"} />;

  const documents = application.data.documents;
  const evidenceTypes = evidenceTypesForScheme(scheme.data, application.data.application.draftFields);

  return (
    <div>
      <PageHeader eyebrow="Evidence" title="Documents" description="Add the evidence required for this application. SevaFix reads documents to help compare them with your answers; you remain responsible for confirming extracted information." />

      <section className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 sm:px-7">
        <div className="border-b border-[var(--rule)] py-5"><h2 className="font-display text-2xl text-[var(--ink)]">Required evidence</h2></div>
        {evidenceTypes.length === 0 ? <div className="border-l-2 border-[var(--review)] py-4 pl-4 text-sm text-[var(--review)]">Complete the required application information before uploading evidence.</div> : evidenceTypes.map((type) => <UploadRow key={type.value} appId={appId} documentType={type.value} label={type.label} uploaded={documents.some((document) => document.documentType === type.value && document.state !== "DELETED")} onUploaded={application.refetch} />)}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Document register</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Uploaded documents</h2></div><p className="text-sm text-[var(--ink-2)]">{documents.length} {documents.length === 1 ? "document" : "documents"}</p></div>
        {documents.length === 0 ? <div className="border-y border-dashed border-[var(--rule-strong)] py-10 text-center"><p className="font-semibold text-[var(--ink)]">No documents uploaded</p><p className="mt-2 text-sm text-[var(--ink-2)]">Choose a required document above to begin.</p></div> : (
          <div className="overflow-x-auto border-y border-[var(--rule-strong)] bg-[var(--sheet)]">
            <table className="w-full min-w-[860px] text-left"><thead className="border-b border-[var(--rule-strong)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-2)]"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Evidence state</th><th className="px-4 py-3">Extracted information</th><th className="px-4 py-3">Last updated</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{documents.map((document) => <DocumentRow key={document.documentId} appId={appId} doc={document} />)}</tbody></table>
          </div>
        )}
        {documents.length ? <p className="mt-3 font-mono text-[11px] text-[var(--ink-2)]">VIEW LINKS EXPIRE AFTER THREE MINUTES AND ARE NOT STORED IN THE BROWSER.</p> : null}
      </section>
    </div>
  );
}
