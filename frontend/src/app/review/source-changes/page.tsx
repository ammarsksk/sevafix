"use client";

import Link from "next/link";

import { ErrorBanner, FullPageSpinner, StatusChip } from "@/components/ui";
import styles from "@/components/reviewer-console.module.css";
import { useSourceChanges } from "@/lib/sevafix/queries";
import { reviewStateChip } from "@/lib/status";

export default function SourceChangesPage() {
  const sourceChanges = useSourceChanges();
  if (sourceChanges.isLoading) return <FullPageSpinner label="Loading review queue…" />;
  if (sourceChanges.error) return <ErrorBanner message={sourceChanges.error instanceof Error ? sourceChanges.error.message : "Could not load source changes"} />;

  const items = sourceChanges.data?.items ?? [];
  return (
    <div>
      <header className={styles.masthead}>
        <div><p className={styles.kicker}>01 / Source change queue</p><h1 className={styles.title}>Review detected source changes</h1><p className={styles.description}>Confirm changes against the official source before they can influence a policy version. Queue rows contain metadata only.</p></div>
        <p className={styles.meta}>ROLE / POLICY REVIEWER</p>
      </header>

      <div className={styles.toolbar}><p className={styles.queueCount}>{String(items.length).padStart(2, "0")} ITEMS AWAITING REVIEW</p><span className={styles.keyHint}>TAB TO NAVIGATE</span></div>

      {items.length === 0 ? <div className={styles.empty}>No source changes are pending review.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Change</th><th>Source</th><th>Scheme</th><th>Detected</th><th>State</th><th>Review</th></tr></thead><tbody>{items.map((change, index) => <tr key={change.changeId}><td className={styles.mono}>{String(index + 1).padStart(2, "0")}</td><td><strong>{change.title ?? change.sourceId}</strong><p className={`${styles.mono} mt-1 text-[var(--ink-2)]`}>{change.contentSha256.slice(0, 16)}…</p></td><td className={styles.mono}>{change.schemeId ?? "—"}</td><td className={styles.mono}>{change.detectedAt ? new Date(change.detectedAt).toLocaleString() : "—"}</td><td><StatusChip spec={reviewStateChip(change.reviewState)} /></td><td><Link href={`/review/source-changes/${encodeURIComponent(change.changeId)}`} className={styles.link}>Open review →</Link></td></tr>)}</tbody></table></div>}

      <div className={styles.unavailable}><strong>Snapshot viewing not yet available</strong>The backend exposes the private snapshot key but no signed viewer or content endpoint. Reviewers must use the linked official source until secure snapshot access is added.</div>
    </div>
  );
}
