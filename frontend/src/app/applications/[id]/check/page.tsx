"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, ErrorBanner, FullPageSpinner, PageHeader, StatusChip } from "@/components/ui";
import { useApplication, useValidate } from "@/lib/sevafix/queries";
import { waitForJob } from "@/lib/sevafix/sevafix-api";
import type { CheckResult } from "@/lib/sevafix/sevafix-types";
import { checkStatusChip, readinessChip } from "@/lib/status";

const POLL_TIMEOUT_MS = 90_000;
const displayValue = (value: unknown) => value === undefined || value === null ? "Not available" : typeof value === "object" ? JSON.stringify(value) : String(value);

function CheckRow({ check }: { check: CheckResult }) {
  const passed = check.status === "PASS" || check.status === "NOT_APPLICABLE";
  const mark = passed ? "✓" : check.status === "FAIL" ? "×" : check.status.startsWith("BLOCKED") ? "—" : "◐";
  const markColor = passed ? "text-[var(--pass)]" : check.status === "FAIL" ? "text-[var(--fail)]" : "text-[var(--review)]";
  return (
    <details className="group border-b border-[var(--rule)] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 gap-3">
          <span aria-hidden="true" className={`mt-0.5 w-5 shrink-0 text-center font-mono text-base font-semibold ${markColor}`}>{mark}</span>
          <div><p className="font-semibold text-[var(--ink)]">{check.ruleId.replaceAll("-", " ").replaceAll("_", " ")}</p><p className="mt-1 text-sm leading-6 text-[var(--ink-2)]">{check.message}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-3"><StatusChip spec={checkStatusChip(check.status)} /><span aria-hidden="true" className="text-[var(--ink-2)] transition-transform group-open:rotate-90">›</span></div>
      </summary>
      <div className="mb-6 ml-0 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-5 sm:ml-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">What we found</dt><dd className="mt-2 text-sm text-[var(--ink-2)]">Actual: <span className="font-semibold text-[var(--ink)]">{displayValue(check.actual)}</span><br />Expected: <span className="font-semibold text-[var(--ink)]">{displayValue(check.expected)}</span></dd></div>
          <div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Why it matters</dt><dd className="mt-2 text-sm text-[var(--ink-2)]">{check.message}</dd></div>
          <div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">What to do</dt><dd className="mt-2 text-sm text-[var(--ink-2)]">{passed ? "No action is required for this check." : check.missingEvidence?.length ? `Add or confirm: ${check.missingEvidence.join(", ")}.` : "Review the application value and its supporting evidence before continuing."}</dd></div>
          <div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Evidence</dt><dd className="mt-2 text-sm text-[var(--ink-2)]">{check.sourceRefs?.length ? check.sourceRefs.join(", ") : "No source reference was returned for this check."}</dd></div>
        </dl>
      </div>
    </details>
  );
}
export default function CheckPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const validate = useValidate(appId);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function onRunValidation() {
    setError(null);
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    try {
      const job = await validate.mutateAsync();
      setPolling(true);
      await waitForJob(job.jobId, { timeoutMs: POLL_TIMEOUT_MS, signal: controllerRef.current.signal });
      await application.refetch();
    } catch (err) { setError(err instanceof Error ? err.message : "We could not complete the application check. Try again."); }
    finally { setPolling(false); }
  }

  if (application.isLoading) return <FullPageSpinner label="Loading application checks…" />;
  const readiness = application.data?.application.readinessSummary;
  const latestRunId = application.data?.application.lastValidationRunId;
  const checks = (application.data?.checks ?? []).filter((check) => !latestRunId || check.runId === latestRunId);
  const groups = [
    { title: "Needs fixing", note: "Resolve these before relying on the application record.", items: checks.filter((check) => check.status === "FAIL" || check.status.startsWith("BLOCKED")) },
    { title: "Needs review", note: "These require your confirmation or better evidence.", items: checks.filter((check) => check.status === "NEEDS_REVIEW") },
    { title: "Passed", note: "These rules matched the current information and evidence.", items: checks.filter((check) => check.status === "PASS" || check.status === "NOT_APPLICABLE") },
  ].filter((group) => group.items.length > 0);

  return (
    <div>
      <PageHeader eyebrow="Application check" title="Check your application" description="SevaFix compares application information, supporting documents, and reviewed policy rules. This is a preparation check, not a government decision." action={<Button onClick={onRunValidation} loading={polling}>{readiness ? "Run checks again" : "Run application checks"}</Button>} />
      <ErrorBanner message={error} />
      {polling ? <div className="mb-6 border-y border-[var(--rule)] py-4"><div className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-[var(--ink)]">Comparing fields, evidence, and policy rules…</span><span className="font-mono text-xs text-[var(--ink-2)]">IN PROGRESS</span></div><div className="mt-3 h-1 bg-[var(--rule)]"><div className="h-full w-2/3 animate-pulse bg-[var(--accent)]" /></div></div> : null}
      <section className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 py-5 sm:px-7">
        {readiness ? <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="font-display text-2xl text-[var(--ink)]">{readiness.ready ? "Ready by SevaFix checks" : "Action required"}</p><div className="mt-2"><StatusChip spec={readinessChip(readiness.label)} /></div><p className="mt-2 max-w-xl text-sm text-[var(--ink-2)]">This reflects SevaFix checks against the current record. It is not an eligibility guarantee or an authority decision.</p></div><dl className="flex flex-wrap gap-x-7 gap-y-2 text-sm"><div><dt className="text-xs text-[var(--ink-2)]">Passed</dt><dd className="mt-1 font-mono text-xl font-semibold text-[var(--pass)]">{readiness.passed}</dd></div><div><dt className="text-xs text-[var(--ink-2)]">Needs fixing</dt><dd className="mt-1 font-mono text-xl font-semibold text-[var(--fail)]">{readiness.failed}</dd></div><div><dt className="text-xs text-[var(--ink-2)]">Needs review</dt><dd className="mt-1 font-mono text-xl font-semibold text-[var(--review)]">{readiness.needsReview}</dd></div><div><dt className="text-xs text-[var(--ink-2)]">Blocked</dt><dd className="mt-1 font-mono text-xl font-semibold text-[var(--review)]">{readiness.blocked}</dd></div></dl></div> : <div><p className="font-semibold text-[var(--ink)]">No checks have been run yet.</p><p className="mt-1 text-sm text-[var(--ink-2)]">Run application checks after adding your information and documents.</p></div>}
      </section>
      <section className="mt-10"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">Check results</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">What needs attention</h2></div><p className="text-sm text-[var(--ink-2)]">Open a rule for evidence and next steps</p></div>{groups.length ? <div className="space-y-8">{groups.map((group) => <section key={group.title}><div className="mb-2 flex items-baseline justify-between border-b border-[var(--rule-strong)] pb-2"><h3 className="font-display text-xl text-[var(--ink)]">{group.title}</h3><p className="hidden text-xs text-[var(--ink-2)] sm:block">{group.note}</p></div><div className="px-1 sm:px-3">{group.items.map((check) => <CheckRow key={`${check.runId}-${check.ruleId}`} check={check} />)}</div></section>)}</div> : <div className="border-y border-dashed border-[var(--rule-strong)] py-10 text-center text-sm text-[var(--ink-2)]">Results will appear here after the first check.</div>}</section>
    </div>
  );
}

