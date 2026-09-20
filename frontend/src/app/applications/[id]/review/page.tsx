"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmModal, ErrorBanner, FullPageSpinner, PageHeader, StatusChip } from "@/components/ui";
import { isFieldVisible, schemeFields } from "@/lib/sevafix/scheme-schema";
import { useApplication, useFreezeVersion, useScheme } from "@/lib/sevafix/queries";
import { documentStateChip, readinessChip } from "@/lib/status";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const scheme = useScheme(application.data?.application.schemeId ?? "");
  const freezeVersion = useFreezeVersion(appId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (application.isLoading || (application.data && scheme.isLoading)) return <FullPageSpinner label="Preparing your review…" />;
  if (!application.data) return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;
  if (!scheme.data) return <ErrorBanner message={scheme.error instanceof Error ? scheme.error.message : "Scheme workflow not found"} />;
  const app = application.data?.application;
  const documents = application.data?.documents ?? [];
  const versions = application.data?.versions ?? [];
  const fields = app?.draftFields ?? {};
  const fieldConfigs = schemeFields(scheme.data).filter((field) => isFieldVisible(field, fields));

  async function onFreeze() {
    setError(null);
    try { await freezeVersion.mutateAsync(); setConfirming(false); }
    catch (err) { setError(err instanceof Error ? err.message : "We could not create this version. Try again."); }
  }

  return (
    <div>
      <PageHeader eyebrow="Readiness review" title="Review before submission" description="Check the full case file, then create an unchanged record of the version you intend to submit on the official portal." action={<div className="flex flex-wrap gap-2 print:hidden"><Button variant="secondary" onClick={() => window.print()}>Print dossier</Button><Button onClick={() => setConfirming(true)}>Create submission version</Button></div>} />
      <ErrorBanner message={error} />

      <article className="border border-[var(--rule-strong)] bg-[var(--sheet)] print:border-0">
        <header className="grid gap-5 border-b border-[var(--rule-strong)] px-5 py-6 sm:grid-cols-[1fr_auto] sm:px-8">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">SevaFix case file · {appId.slice(0, 8)}</p><h2 className="mt-2 font-display text-3xl text-[var(--ink)]">Application dossier</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-2)]">Prepared from the current draft and uploaded evidence. This document is not issued by a government authority.</p></div>
          <div className="sm:text-right"><p className="text-xs text-[var(--ink-2)]">Application readiness</p>{app?.readinessSummary ? <div className="mt-2"><StatusChip spec={readinessChip(app.readinessSummary.label)} /></div> : <p className="mt-2 text-sm font-semibold text-[var(--review)]">Checks not run</p>}</div>
        </header>

        <section className="px-5 py-7 sm:px-8"><div className="mb-4 flex items-end justify-between border-b border-[var(--rule-strong)] pb-3"><div><p className="eyebrow">01 · Application information</p><h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Details in this draft</h3></div><p className="hidden text-xs text-[var(--ink-2)] sm:block">Review every line</p></div><dl>{fieldConfigs.map((field) => <div key={field.key} className="grid gap-1 border-b border-[var(--rule)] py-3 sm:grid-cols-[minmax(180px,0.8fr)_1.5fr] sm:gap-6"><dt className="text-xs font-semibold text-[var(--ink-2)]">{field.label}</dt><dd className="text-sm text-[var(--ink)]">{fields[field.key] === null || fields[field.key] === undefined || fields[field.key] === "" ? <span className="font-semibold text-[var(--fail)]">× Not provided</span> : String(fields[field.key])}</dd></div>)}</dl></section>

        <section className="border-t border-[var(--rule-strong)] px-5 py-7 sm:px-8"><div className="mb-4"><p className="eyebrow">02 · Evidence register</p><h3 className="mt-2 font-display text-2xl text-[var(--ink)]">Documents in this draft</h3></div>{documents.length === 0 ? <div className="border-y border-dashed border-[var(--rule-strong)] py-8 text-sm text-[var(--ink-2)]">No documents have been uploaded.</div> : <div className="overflow-x-auto border-y border-[var(--rule-strong)]"><table className="w-full min-w-[600px] text-left"><thead className="border-b border-[var(--rule-strong)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-2)]"><tr><th className="px-3 py-3">Document</th><th className="px-3 py-3">Evidence state</th><th className="px-3 py-3">Updated</th></tr></thead><tbody>{documents.map((doc) => <tr key={doc.documentId} className="border-b border-[var(--rule)] last:border-b-0"><td className="px-3 py-4 text-sm font-semibold text-[var(--ink)]">{doc.documentType.replaceAll("_", " ")}</td><td className="px-3 py-4"><StatusChip spec={documentStateChip(doc.state)} /></td><td className="px-3 py-4 font-mono text-xs text-[var(--ink-2)]">{new Date(doc.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>
      </article>

      <section className="mt-10 print:hidden"><div className="mb-4"><p className="eyebrow">Version history</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Saved submission versions</h2></div>{versions.length === 0 ? <div className="border-y border-dashed border-[var(--rule-strong)] py-8"><p className="text-sm font-semibold text-[var(--ink)]">No submission version yet</p><p className="mt-1 text-sm text-[var(--ink-2)]">Create one when the information and evidence are ready.</p></div> : <ol className="border-y border-[var(--rule-strong)]">{[...versions].sort((a, b) => a.versionNumber - b.versionNumber).map((version) => <li key={version.versionId} className="grid gap-3 border-b border-[var(--rule)] py-5 last:border-b-0 sm:grid-cols-[72px_1fr_auto]"><span className="font-mono text-xs font-semibold text-[var(--accent)]">V{String(version.versionNumber).padStart(2, "0")}</span><div><p className="font-semibold text-[var(--ink)]">Immutable submission snapshot</p><p className="mt-1 text-xs text-[var(--ink-2)]">Policy {version.policyVersionId ?? "not recorded"}</p></div><time className="font-mono text-xs text-[var(--ink-2)]">{new Date(version.createdAt).toLocaleString()}</time></li>)}</ol>}</section>

      {confirming ? <ConfirmModal title="Create a submission version?" description="This records the current application exactly as it is now. You can continue editing the working draft, but this version will not change." confirmLabel="Create version" onConfirm={onFreeze} onClose={() => setConfirming(false)} busy={freezeVersion.isPending} /> : null}
    </div>
  );
}
