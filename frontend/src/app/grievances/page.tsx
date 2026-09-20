"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import { Button, ErrorBanner, FullPageSpinner, PageHeader, TextField } from "@/components/ui";
import { useApplications, useOpenGrievance, useSchemes } from "@/lib/sevafix/queries";

type SourceApplication = "SEVAFIX" | "EXTERNAL";

function GrievanceContent() {
  const router = useRouter();
  const schemes = useSchemes();
  const applications = useApplications();
  const openGrievance = useOpenGrievance();
  const [sourceApplication, setSourceApplication] = useState<SourceApplication>("EXTERNAL");
  const [schemeId, setSchemeId] = useState("");
  const [existingApplicationId, setExistingApplicationId] = useState("");
  const [officialApplicationId, setOfficialApplicationId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedSchemeId = schemeId || schemes.data?.items[0]?.schemeId || "";
  const matchingApplications = useMemo(() => (applications.data?.items ?? []).filter((application) => application.schemeId === selectedSchemeId), [applications.data?.items, selectedSchemeId]);
  const selectedExistingApplicationId = matchingApplications.some((item) => item.appId === existingApplicationId) ? existingApplicationId : (matchingApplications[0]?.appId ?? "");

  if (schemes.isLoading || applications.isLoading) return <FullPageSpinner label="Preparing diagnosis options…" />;

  async function onContinue() {
    setError(null);
    if (!selectedSchemeId) return setError("Select the government scheme.");
    if (sourceApplication === "SEVAFIX" && !selectedExistingApplicationId) return setError("Select the SevaFix application that was rejected or returned.");
    if (sourceApplication === "EXTERNAL" && !officialApplicationId.trim()) return setError("Enter the official application ID.");
    try {
      const application = await openGrievance.mutateAsync({ schemeId: selectedSchemeId, sourceApplication, ...(rejectionReason.trim() ? { rejectionReason: rejectionReason.trim() } : {}), ...(sourceApplication === "SEVAFIX" ? { existingApplicationId: selectedExistingApplicationId } : { officialApplicationId: officialApplicationId.trim(), ...(submittedAt ? { submittedAt: new Date(submittedAt).toISOString() } : {}) }) });
      router.push(`/applications/${application.appId}/diagnose`);
    } catch (err) { setError(err instanceof Error ? err.message : "We could not open this diagnosis. Try again."); }
  }

  return (
    <div>
      <PageHeader eyebrow="Repair journey" title="Diagnose a failed application" description="Use the exact information the authority provided. SevaFix will separate official reasons from issues inferred from the available evidence." />
      <div className="grid gap-9 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 py-6 sm:px-7">
          <ErrorBanner message={error} />
          <fieldset><legend className="text-sm font-semibold text-[var(--ink)]">Where was this application prepared?</legend><div className="mt-3 grid border border-[var(--rule-strong)] sm:grid-cols-2">{([{"value":"EXTERNAL","title":"Outside SevaFix","copy":"Use the official application reference."},{"value":"SEVAFIX","title":"Inside SevaFix","copy":"Choose one of your existing applications."}] as const).map((option) => <button key={option.value} type="button" onClick={() => setSourceApplication(option.value)} className={`min-h-24 border-b p-4 text-left last:border-b-0 sm:border-b-0 sm:first:border-r ${sourceApplication === option.value ? "border-l-2 border-l-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--sheet)] hover:bg-[var(--paper)]"}`}><span className="block font-semibold text-[var(--ink)]">{sourceApplication === option.value ? "✓ " : ""}{option.title}</span><span className="mt-1 block text-sm text-[var(--ink-2)]">{option.copy}</span></button>)}</div></fieldset>
          <label className="mt-6 block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">Government scheme</span><select className="w-full rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2" value={selectedSchemeId} onChange={(event) => { setSchemeId(event.target.value); setExistingApplicationId(""); }}>{(schemes.data?.items ?? []).map((scheme) => <option key={scheme.schemeId} value={scheme.schemeId}>{scheme.name}</option>)}</select></label>
          {sourceApplication === "SEVAFIX" ? <label className="mt-5 block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">Existing SevaFix application</span><select className="w-full rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2" value={selectedExistingApplicationId} onChange={(event) => setExistingApplicationId(event.target.value)}>{matchingApplications.length === 0 ? <option value="">No applications found for this scheme</option> : null}{matchingApplications.map((application) => <option key={application.appId} value={application.appId}>{application.appId} — {application.lifecycleStatus.replaceAll("_", " ")}</option>)}</select></label> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><TextField label="Official application ID" value={officialApplicationId} onChange={(event) => setOfficialApplicationId(event.target.value)} autoComplete="off" /><TextField label="Original submission date" type="datetime-local" value={submittedAt} onChange={(event) => setSubmittedAt(event.target.value)} /></div>}
          <label className="mt-5 block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">Official rejection or return reason, if provided</span><textarea className="w-full rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2 text-sm" rows={5} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Paste the portal message or enter the authority's wording" /><span className="mt-1.5 block text-xs leading-5 text-[var(--ink-2)]">If no reason was provided, leave this blank. Any diagnosis will be clearly labelled as inferred.</span></label>
          <Button className="mt-6" onClick={onContinue} loading={openGrievance.isPending}>Continue to evidence</Button>
        </section>

        <aside className="border-t-2 border-[var(--accent)] pt-6"><p className="eyebrow">What happens next</p><ol className="mt-5 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">{["Add the rejection notice and submitted evidence.", "Compare them with reviewed scheme checks.", "See the likely issue and its supporting sources.", "Create a corrected version without changing the original."].map((item, index) => <li key={item} className="flex gap-4 py-4 text-sm leading-6 text-[var(--ink)]"><span className="font-mono text-xs text-[var(--ink-2)]">{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol><p className="mt-5 text-sm leading-6 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Evidence-led:</strong> when the available evidence is insufficient, SevaFix says so rather than presenting an inference as an official reason.</p></aside>
      </div>
    </div>
  );
}
export default function GrievancesPage() { return <ProtectedRoute><GrievanceContent /></ProtectedRoute>; }

