"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card, ErrorBanner, FullPageSpinner, StatusChip, TextField } from "@/components/ui";
import { evidenceTypesFor } from "@/lib/sevafix/pm-usp-schema";
import { useApplication, useConfirmDocumentFacts, useDeleteDocument } from "@/lib/sevafix/queries";
import { sevaFixApi } from "@/lib/sevafix/sevafix-api";
import type { DocumentRecord } from "@/lib/sevafix/sevafix-types";
import { uploadDocument } from "@/lib/sevafix/document-upload";
import { documentStateChip } from "@/lib/status";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];

const NON_TERMINAL_STATES = new Set([
  "PENDING_UPLOAD",
  "SCANNING",
  "SCAN_CLEAN",
  "UPLOADED",
  "OCR_RUNNING",
]);

function FactConfirmationForm({
  appId,
  doc,
}: {
  appId: string;
  doc: DocumentRecord;
}) {
  const confirmFacts = useConfirmDocumentFacts(appId);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, fact] of Object.entries(doc.extractedFacts ?? {})) {
      initial[key] = String(fact.value ?? "");
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    try {
      const facts = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          { ...(doc.extractedFacts?.[key] ?? {}), value, confidence: 100 },
        ]),
      );
      await confirmFacts.mutateAsync({ documentId: doc.documentId, facts });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm facts");
    }
  }

  const entries = Object.entries(doc.extractedFacts ?? {});
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-medium text-amber-900">
        Please confirm the details we read from this document.
      </p>
      <ErrorBanner message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(([key, fact]) => (
          <div key={key}>
            <TextField
              label={key}
              value={values[key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            {typeof fact.confidence === "number" && fact.confidence < 98 ? (
              <p className="mt-1 text-xs text-amber-700">
                Low confidence extraction ({fact.confidence.toFixed(0)}%) — please check carefully.
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={onSubmit} loading={confirmFacts.isPending}>
        Confirm details
      </Button>
    </div>
  );
}

function DocumentRow({ appId, doc }: { appId: string; doc: DocumentRecord }) {
  const deleteDocument = useDeleteDocument(appId);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onView() {
    setViewError(null);
    setViewing(true);
    try {
      const { viewUrl } = await sevaFixApi.documentViewUrl(doc.documentId);
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Could not open document");
    } finally {
      setViewing(false);
    }
  }

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteDocument.mutateAsync(doc.documentId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete document");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{doc.documentType}</p>
          <p className="text-xs text-slate-500">
            {(doc.declaredSize / 1024).toFixed(0)} KB · {doc.contentType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip spec={documentStateChip(doc.state)} />
          <Button variant="secondary" onClick={onView} loading={viewing}>
            View
          </Button>
          <Button
            variant="danger"
            onClick={onDelete}
            loading={deleteDocument.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
      <ErrorBanner message={viewError} />
      <ErrorBanner message={deleteError} />
      {doc.state === "NEEDS_USER_CONFIRMATION" ? (
        <FactConfirmationForm appId={appId} doc={doc} />
      ) : null}
      {doc.state === "OCR_FAILED_FINAL" || doc.state === "UNSUPPORTED_LANGUAGE" ? (
        <p className="mt-2 text-xs text-red-700">
          {doc.ocrFailure ?? "This document could not be read automatically. You can delete it and upload a clearer copy."}
        </p>
      ) : null}
    </Card>
  );
}

function UploadSlot({ appId, documentType, label, onUploaded }: { appId: string; documentType: string; label: string; onUploaded: () => Promise<unknown> }) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PDF, JPEG, PNG, or TIFF files are accepted.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File is larger than the 10 MiB limit.");
      return;
    }
    setUploading(true);
    try {
      await uploadDocument(appId, documentType, file);
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <label>
          <span
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {uploading ? "Uploading…" : "Upload"}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
            disabled={uploading}
            onChange={(e) => onFileSelected(e.target.files?.[0])}
          />
        </label>
      </div>
      <ErrorBanner message={error} />
    </Card>
  );
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);

  useEffect(() => {
    const hasPending = application.data?.documents.some((d) => NON_TERMINAL_STATES.has(d.state));
    if (!hasPending) return;
    const interval = setInterval(() => {
      void application.refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [application]);

  if (application.isLoading) return <FullPageSpinner />;

  if (!application.data) {
    return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;
  }

  const documents = application.data.documents;
  const applicationType = application.data.application.draftFields["application.type"];
  const evidenceTypes = evidenceTypesFor(application.data.application.draftFields);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Upload evidence</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {!applicationType ? (
            <Card className="sm:col-span-2"><p className="text-sm text-amber-800">Choose Fresh or Renewal on the Draft tab before uploading evidence.</p></Card>
          ) : evidenceTypes.map((type) => (
            <UploadSlot key={type.value} appId={appId} documentType={type.value} label={type.label} onUploaded={application.refetch} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Your documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocumentRow key={doc.documentId} appId={appId} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
