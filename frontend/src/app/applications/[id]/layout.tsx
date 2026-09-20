"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import { StatusChip } from "@/components/ui";
import { useApplication, useScheme } from "@/lib/sevafix/queries";
import { lifecycleChip } from "@/lib/status";

type Stage = { segment: string; label: string; description: string; anchor?: string };
const stages: Stage[] = [
  { segment: "edit", label: "Form", description: "Application answers" },
  { segment: "documents", label: "Documents", description: "Evidence and extracted values" },
  { segment: "check", label: "Checks", description: "Rules and consistency" },
  { segment: "review", label: "Review", description: "Summary and freeze" },
  { segment: "tracking", label: "Submission", description: "Official portal record" },
  { segment: "tracking", label: "Tracking", description: "Dated status history", anchor: "history" },
];

function StageMark({ state }: { state: "complete" | "attention" | "current" | "pending" }) {
  const value = state === "complete" ? "✓" : state === "attention" ? "×" : state === "current" ? "◐" : "—";
  const tone = state === "complete" ? "border-[var(--pass)] bg-[var(--pass)] text-white" : state === "attention" ? "border-[var(--fail)] text-[var(--fail)]" : state === "current" ? "border-[var(--review)] text-[var(--review)]" : "border-[var(--rule-strong)] text-[var(--neutral)]";
  return <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border font-mono text-[0.65rem] ${tone}`}>{value}</span>;
}

function Workspace({ appId, children }: { appId: string; children: ReactNode }) {
  const pathname = usePathname();
  const application = useApplication(appId);
  const data = application.data;
  const app = data?.application;
  const scheme = useScheme(app?.schemeId ?? "");
  const schemeName = scheme.data?.name ?? app?.schemeId ?? "Application";
  const currentSegment = pathname.split("/").at(-1) ?? "edit";
  const failedChecks = data?.checks.some((check) => check.status === "FAIL" || check.status.startsWith("BLOCKED"));
  const pendingDocuments = data?.documents.some((document) => ["PENDING_UPLOAD", "UPLOADED", "OCR_RUNNING", "NEEDS_USER_CONFIRMATION"].includes(document.state));

  const stageState = (stage: Stage): "complete" | "attention" | "current" | "pending" => {
    const active = currentSegment === stage.segment && (stage.label !== "Tracking" || Boolean(app?.submittedAt));
    if (active) return "current";
    if (stage.label === "Form") return app && Object.keys(app.draftFields ?? {}).length > 0 ? "complete" : "pending";
    if (stage.label === "Documents") return pendingDocuments ? "attention" : data?.documents.length ? "complete" : "pending";
    if (stage.label === "Checks") return failedChecks ? "attention" : data?.validationRuns.length ? "complete" : "pending";
    if (stage.label === "Review") return data?.versions.length ? "complete" : "pending";
    if (stage.label === "Submission") return app?.submittedAt ? "complete" : "pending";
    if (stage.label === "Tracking") return data?.timeline.length ? "complete" : "pending";
    return "pending";
  };

  return (
    <div>
      <Link href="/dashboard" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline decoration-[var(--rule-strong)] hover:decoration-[var(--accent)]">← All applications</Link>
      <header className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Application case file</p><h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-medium leading-none tracking-[-0.035em] text-[var(--ink)] sm:text-4xl">{schemeName}</h1></div>{app ? <StatusChip spec={lifecycleChip(app.lifecycleStatus)} /> : null}</div>
        <dl className="mt-6 grid gap-3 border-t border-[var(--rule)] pt-4 text-xs text-[var(--ink-2)] sm:grid-cols-3"><div><dt className="font-mono uppercase tracking-[0.08em]">Policy version</dt><dd className="mt-1 text-[var(--ink)]">{app?.policyVersionId ?? "Not assigned"}</dd></div><div><dt className="font-mono uppercase tracking-[0.08em]">Last saved</dt><dd className="mt-1 text-[var(--ink)]">{app?.updatedAt ? new Date(app.updatedAt).toLocaleString("en-IN") : "Loading…"}</dd></div><div><dt className="font-mono uppercase tracking-[0.08em]">Frozen version</dt><dd className="mt-1 text-[var(--ink)]">{app?.currentVersion ? `Version ${app.currentVersion}` : "Not yet frozen"}</dd></div></dl>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex gap-1 overflow-x-auto border-b border-[var(--rule)] pb-2 lg:block lg:overflow-visible lg:border-b-0 lg:pb-0" aria-label="Application stages">
            {stages.map((stage, index) => {
              const href = `/applications/${appId}/${stage.segment}${stage.anchor ? `#${stage.anchor}` : ""}`;
              const active = currentSegment === stage.segment && (stage.label !== "Tracking" || Boolean(app?.submittedAt));
              const state = stageState(stage);
              return <Link key={`${stage.label}-${index}`} href={href} aria-current={active ? "step" : undefined} className={`grid min-w-[12rem] grid-cols-[1.5rem_1fr] gap-3 border-l-2 px-3 py-3 transition-colors lg:min-w-0 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent hover:border-[var(--rule-strong)] hover:bg-[var(--sheet)]"}`}><StageMark state={state} /><span><span className="block text-sm font-semibold text-[var(--ink)]">{stage.label}</span><span className="mt-1 hidden text-xs leading-5 text-[var(--ink-2)] lg:block">{stage.description}</span></span></Link>;
            })}
            <Link href={`/applications/${appId}/diagnose`} aria-current={currentSegment === "diagnose" ? "step" : undefined} className={`mt-2 grid min-w-[12rem] grid-cols-[1.5rem_1fr] gap-3 border-l-2 border-t border-[var(--rule)] px-3 py-4 lg:min-w-0 ${currentSegment === "diagnose" ? "border-l-[var(--review)] bg-[var(--warning-soft)]" : "border-l-transparent"}`}><StageMark state={data?.diagnoses.length ? "complete" : currentSegment === "diagnose" ? "current" : "pending"} /><span><span className="block text-sm font-semibold">Diagnose</span><span className="mt-1 hidden text-xs text-[var(--ink-2)] lg:block">Evidence and repair</span></span></Link>
          </nav>
        </aside>
        <section className="min-w-0 pb-16">{children}</section>
      </div>
    </div>
  );
}

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  return <ProtectedRoute><Workspace appId={params.id}>{children}</Workspace></ProtectedRoute>;
}
