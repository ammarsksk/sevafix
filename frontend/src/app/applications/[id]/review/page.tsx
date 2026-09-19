"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Button, Card, ConfirmModal, ErrorBanner, FullPageSpinner, StatusChip } from "@/components/ui";
import { PM_USP_FIELDS } from "@/lib/sevafix/pm-usp-schema";
import { useApplication, useFreezeVersion } from "@/lib/sevafix/queries";
import { documentStateChip, readinessChip } from "@/lib/status";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const freezeVersion = useFreezeVersion(appId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (application.isLoading) return <FullPageSpinner />;

  const app = application.data?.application;
  const documents = application.data?.documents ?? [];
  const versions = application.data?.versions ?? [];
  const fields = app?.draftFields ?? {};

  async function onFreeze() {
    setError(null);
    try {
      await freezeVersion.mutateAsync();
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not freeze this version");
    }
  }

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Readiness</h2>
            {app?.readinessSummary ? (
              <StatusChip spec={readinessChip(app.readinessSummary.label)} />
            ) : (
              <p className="text-sm text-slate-500">Run validation before freezing a version.</p>
            )}
          </div>
          <Button onClick={() => setConfirming(true)}>Freeze this version</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Draft fields</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {PM_USP_FIELDS.map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-slate-500">{field.label}</dt>
              <dd className="text-sm font-medium text-slate-900">
                {fields[field.key] === null || fields[field.key] === undefined
                  ? "—"
                  : String(fields[field.key])}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.documentId} className="flex items-center justify-between text-sm">
                <span>{doc.documentType}</span>
                <StatusChip spec={documentStateChip(doc.state)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Frozen versions</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-slate-500">No versions frozen yet.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((version) => (
              <li key={version.versionId} className="flex items-center justify-between text-sm">
                <span>Version {version.versionNumber}</span>
                <span className="text-xs text-slate-500">
                  {new Date(version.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirming ? (
        <ConfirmModal
          title="Freeze this version?"
          description="This creates an immutable snapshot of the current draft. You can keep editing the draft afterward and freeze new versions."
          confirmLabel="Freeze version"
          onConfirm={onFreeze}
          onClose={() => setConfirming(false)}
          busy={freezeVersion.isPending}
        />
      ) : null}
    </div>
  );
}
