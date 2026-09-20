"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/reviewer-console.module.css";
import { Button, ConfirmModal, ErrorBanner, FullPageSpinner, StatusChip } from "@/components/ui";
import { useApproveSourceChange, useRejectSourceChange, useSourceChange } from "@/lib/sevafix/queries";
import { reviewStateChip } from "@/lib/status";

type Decision = "APPROVE" | "REJECT";

export default function SourceChangeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const changeId = params.id;
  const sourceChange = useSourceChange(changeId);
  const approve = useApproveSourceChange();
  const reject = useRejectSourceChange();
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (sourceChange.isLoading) return <FullPageSpinner label="Loading source change…" />;
  if (!sourceChange.data) return <ErrorBanner message={sourceChange.error instanceof Error ? sourceChange.error.message : "Source change not found"} />;
  const change = sourceChange.data;
  const pending = change.reviewState === "CHANGED";

  function prepareDecision(next: Decision) {
    setError(null);
    if (!reason.trim()) { setError("Enter a decision reason before continuing."); return; }
    setDecision(next);
  }

  async function confirmDecision() {
    if (!decision || !reason.trim()) return;
    setError(null);
    try {
      if (decision === "APPROVE") await approve.mutateAsync(changeId);
      else await reject.mutateAsync({ changeId, reason: reason.trim() });
      router.push("/review/source-changes");
    } catch (err) { setError(err instanceof Error ? err.message : `Could not ${decision.toLowerCase()} this source change`); }
  }

  return (
    <div>
      <header className={styles.masthead}>
        <div><p className={styles.kicker}>Source review / {change.changeId}</p><h1 className={styles.title}>{change.title ?? change.sourceId}</h1><p className={styles.description}>Verify authority, timing, and controlling language before recording a decision.</p></div>
        <StatusChip spec={reviewStateChip(change.reviewState)} />
      </header>

      <div className={styles.toolbar}><Link href="/review/source-changes" className={styles.link}>← Back to queue</Link>{change.sourceUrl ? <a href={change.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Open official source ↗</a> : <span className={styles.meta}>NO PUBLIC SOURCE URL</span>}</div>
      <ErrorBanner message={error} />

      <section className={styles.section} aria-labelledby="change-metadata"><h2 id="change-metadata" className={styles.sectionTitle}>Change metadata</h2><p className={styles.sectionNote}>Values returned by the reviewer API.</p><dl className={styles.definition}>
        <div className={styles.definitionRow}><dt>Change ID</dt><dd className={styles.mono}>{change.changeId}</dd></div>
        <div className={styles.definitionRow}><dt>Source ID</dt><dd className={styles.mono}>{change.sourceId}</dd></div>
        <div className={styles.definitionRow}><dt>Scheme</dt><dd className={styles.mono}>{change.schemeId ?? "Not supplied"}</dd></div>
        <div className={styles.definitionRow}><dt>Detected</dt><dd className={styles.mono}>{change.detectedAt ? new Date(change.detectedAt).toLocaleString() : "Not supplied"}</dd></div>
        <div className={styles.definitionRow}><dt>Content digest</dt><dd className={styles.mono}>{change.contentSha256}</dd></div>
        <div className={styles.definitionRow}><dt>Private snapshot key</dt><dd className={styles.mono}>{change.snapshotKey}</dd></div>
      </dl></section>

      <section className={styles.section} aria-labelledby="snapshot"><h2 id="snapshot" className={styles.sectionTitle}>Source snapshot</h2><div className={styles.unavailable}><strong>Snapshot viewing not yet available</strong>The API does not provide a signed snapshot URL or content endpoint. A safe visual diff cannot be shown from the private key alone. Compare the metadata with the official source above.</div></section>

      {pending ? <section className={styles.section} aria-labelledby="decision"><h2 id="decision" className={styles.sectionTitle}>Record decision</h2><p className={styles.sectionNote}>A reason is required. No action is retried automatically if the request fails.</p><label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold">Decision reason</span><textarea rows={5} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full px-3 py-2 text-sm" placeholder="State what you checked and why this decision is appropriate" /></label><p className="mt-2 text-xs text-[var(--review)]">The current approval endpoint records reviewer identity and time but does not persist the approval note. Rejection reasons are persisted.</p><div className={styles.decisionBar}><Button onClick={() => prepareDecision("APPROVE")} disabled={!reason.trim()}>Approve source change</Button><Button variant="danger" onClick={() => prepareDecision("REJECT")} disabled={!reason.trim()}>Reject source change</Button></div></section> : <section className={styles.section}><h2 className={styles.sectionTitle}>Recorded decision</h2><dl className={styles.definition}><div className={styles.definitionRow}><dt>Reviewer</dt><dd className={styles.mono}>{change.reviewedBy ?? "Not supplied"}</dd></div><div className={styles.definitionRow}><dt>Reviewed</dt><dd className={styles.mono}>{change.reviewedAt ? new Date(change.reviewedAt).toLocaleString() : "Not supplied"}</dd></div><div className={styles.definitionRow}><dt>Reason</dt><dd>{change.reviewReason ?? "No persisted reason returned"}</dd></div></dl></section>}

      {decision ? <ConfirmModal title={`${decision === "APPROVE" ? "Approve" : "Reject"} source change?`} description={<div><p>This records <strong>{decision}</strong> for source <span className="font-mono">{change.sourceId}</span>.</p><p className="mt-2 text-sm">Reason: {reason.trim()}</p></div>} confirmLabel={decision === "APPROVE" ? "Approve change" : "Reject change"} danger={decision === "REJECT"} onConfirm={confirmDecision} onClose={() => setDecision(null)} busy={approve.isPending || reject.isPending} /> : null}
    </div>
  );
}
