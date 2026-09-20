"use client";

import Link from "next/link";

import { ProtectedRoute } from "@/components/route-guards";
import { ErrorBanner, FullPageSpinner, PageHeader, StatusChip } from "@/components/ui";
import { useApplications, useMe, useSchemes } from "@/lib/sevafix/queries";
import { lifecycleChip } from "@/lib/status";

function nextAction(status: string, journey?: string) {
  if (journey === "GRIEVANCE") return ["Review diagnosis evidence", "diagnose"];
  if (status === "READY_WITH_SEVAFIX_CHECKS") return ["Review and freeze version", "review"];
  if (status === "SUBMITTED") return ["Update tracking history", "tracking"];
  if (status === "ACTION_REQUIRED") return ["Resolve application checks", "check"];
  if (status === "REPAIR_DRAFT") return ["Continue corrected version", "edit"];
  return ["Continue application form", "edit"];
}
function DashboardContent() {
  const me = useMe();
  const applications = useApplications();
  const schemes = useSchemes();
  if (me.isLoading || applications.isLoading || schemes.isLoading) return <FullPageSpinner label="Loading your applications…" />;
  const items = applications.data?.items ?? [];
  const schemeNames = new Map((schemes.data?.items ?? []).map((scheme) => [scheme.schemeId, scheme.name]));

  return (
    <div>
      <PageHeader eyebrow="Your workspace" title={me.data?.displayName ? `${me.data.displayName}’s applications` : "Your applications"} description="Continue the next required action, start a new preparation, or diagnose a returned application." />
      {me.data?.profileStatus === "EMPTY" ? <div className="mb-8 border-l-2 border-[var(--review)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--ink-2)]">Your profile is incomplete. <Link href="/settings" className="font-semibold text-[var(--accent)] underline">Add your name and notification preferences.</Link></div> : null}

      <section aria-label="Start a journey" className="border-y border-[var(--rule-strong)]">
        <Link href="/schemes" className="group grid gap-3 border-b border-[var(--rule)] py-6 sm:grid-cols-[7rem_1fr_auto] sm:items-center"><span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Prepare</span><span><strong className="block font-[family-name:var(--font-display)] text-2xl font-medium">Start a new application</strong><small className="mt-1 block text-sm leading-6 text-[var(--ink-2)]">Catch preventable problems before submission.</small></span><span className="font-semibold text-[var(--accent)] transition-transform group-hover:translate-x-1">Start →</span></Link>
        <Link href="/grievances" className="group grid gap-3 py-6 sm:grid-cols-[7rem_1fr_auto] sm:items-center"><span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--review)]">Diagnose</span><span><strong className="block font-[family-name:var(--font-display)] text-2xl font-medium">Understand a returned application</strong><small className="mt-1 block text-sm leading-6 text-[var(--ink-2)]">See the evidence and prepare a focused correction.</small></span><span className="font-semibold text-[var(--accent)] transition-transform group-hover:translate-x-1">Start →</span></Link>
      </section>

      <ErrorBanner message={applications.error instanceof Error ? applications.error.message : null} />
      <section className="mt-14" aria-labelledby="application-ledger-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Application ledger</p><h2 id="application-ledger-title" className="mt-2 font-[family-name:var(--font-display)] text-3xl font-medium tracking-[-0.03em]">Current work</h2></div><p className="font-mono text-xs text-[var(--ink-2)]">{items.length} {items.length === 1 ? "record" : "records"}</p></div>
        {items.length === 0 ? <div className="border-y border-dashed border-[var(--rule-strong)] bg-[var(--warning-soft)] py-12 text-center"><h3 className="font-[family-name:var(--font-display)] text-2xl font-medium">Your case file is empty.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ink-2)]">Start with the scheme you are preparing. Answers, documents, checks, and later status updates will remain together.</p><Link href="/schemes" className="mt-6 inline-flex min-h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white">Browse supported schemes</Link></div> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="border-y border-[var(--rule-strong)] font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[var(--ink-2)]"><th className="py-3 pr-5 font-medium">Next action</th><th className="px-5 py-3 font-medium">Application</th><th className="px-5 py-3 font-medium">Journey</th><th className="px-5 py-3 font-medium">Status</th><th className="py-3 pl-5 font-medium">Updated</th></tr></thead><tbody>{items.map((app) => { const [action, stage] = nextAction(app.lifecycleStatus, app.journeyType); const href = `/applications/${app.appId}/${stage}`; return <tr key={app.appId} className="border-b border-[var(--rule)] hover:bg-[var(--sheet)]"><td className="py-5 pr-5"><Link href={href} className="font-semibold text-[var(--accent)] underline decoration-[var(--rule-strong)] hover:decoration-[var(--accent)]">{action} →</Link></td><td className="px-5 py-5"><p className="font-semibold">{schemeNames.get(app.schemeId) ?? app.schemeId}</p><p className="mt-1 font-mono text-[0.68rem] text-[var(--ink-2)]">APP · {app.appId.slice(-8)}</p></td><td className="px-5 py-5 text-sm text-[var(--ink-2)]">{app.journeyType === "GRIEVANCE" ? "Diagnosis and repair" : "Preparation"}</td><td className="px-5 py-5"><StatusChip spec={lifecycleChip(app.lifecycleStatus)} /></td><td className="whitespace-nowrap py-5 pl-5 font-mono text-xs text-[var(--ink-2)]">{new Date(app.updatedAt).toLocaleString("en-IN")}</td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}

export default function DashboardPage() { return <ProtectedRoute><DashboardContent /></ProtectedRoute>; }
