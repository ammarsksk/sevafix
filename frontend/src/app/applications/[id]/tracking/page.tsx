"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Button, ErrorBanner, FullPageSpinner, PageHeader, TextField } from "@/components/ui";
import { useAddTimelineEvent, useApplication, useRecordSubmission } from "@/lib/sevafix/queries";

export default function TrackingPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const recordSubmission = useRecordSubmission(appId);
  const addTimelineEvent = useAddTimelineEvent(appId);
  const [officialId, setOfficialId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [eventType, setEventType] = useState("STATUS_CHECKED");
  const [eventNote, setEventNote] = useState("");
  const [eventError, setEventError] = useState<string | null>(null);

  if (application.isLoading) return <FullPageSpinner label="Loading submission history…" />;
  const app = application.data?.application;
  const timeline = application.data?.timeline ?? [];
  const hasFrozenVersion = (application.data?.versions.length ?? 0) > 0;

  async function onRecordSubmission() {
    setSubmissionError(null);
    if (!officialId || !submittedAt) return setSubmissionError("Enter both the official application ID and submission date.");
    try { await recordSubmission.mutateAsync({ officialApplicationId: officialId, submittedAt: new Date(submittedAt).toISOString() }); setOfficialId(""); setSubmittedAt(""); }
    catch (err) { setSubmissionError(err instanceof Error ? err.message : "We could not record the submission. Try again."); }
  }

  async function onAddEvent() {
    setEventError(null);
    if (!eventType) return setEventError("Choose an event type.");
    try { await addTimelineEvent.mutateAsync({ eventType, payload: { note: eventNote } }); setEventNote(""); }
    catch (err) { setEventError(err instanceof Error ? err.message : "We could not add this update. Try again."); }
  }

  return (
    <div>
      <PageHeader eyebrow="Official submission" title="Submission and history" description="SevaFix does not submit applications. Submit on the government portal, then keep the reference and status history here." action={<a href="https://scholarships.gov.in/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">Open official portal ↗</a>} />
      <div className="mb-6 border-l-2 border-[var(--evidence)] bg-[color-mix(in_srgb,var(--evidence)_35%,transparent)] px-4 py-3 text-sm text-[var(--ink-2)]"><strong className="text-[var(--ink)]">You are leaving SevaFix.</strong> Confirm the portal address and never share your password or OTP.</div>

      <section className="border-y border-[var(--rule-strong)] bg-[var(--sheet)] px-5 py-6 sm:px-7">
        <h2 className="font-display text-2xl text-[var(--ink)]">Record an official submission</h2>
        {app?.officialApplicationIdDisplay ? <dl className="mt-5 grid gap-5 border-l-2 border-[var(--pass)] bg-[var(--success-soft)] p-5 sm:grid-cols-2"><div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Official application ID · redacted</dt><dd className="mt-2 font-semibold text-[var(--ink)]">{app.officialApplicationIdDisplay}</dd></div><div><dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">Submitted</dt><dd className="mt-2 text-sm text-[var(--ink)]">{app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "Not recorded"}</dd></div></dl> : <><p className="mt-2 text-sm text-[var(--ink-2)]">Create a submission version first, then enter the reference shown by the official portal.</p>{!hasFrozenVersion ? <div className="mt-4 border-l-2 border-[var(--review)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--ink-2)]">Create at least one submission version under Review before recording an official submission.</div> : null}<ErrorBanner message={submissionError} /><div className="mt-5 grid gap-4 sm:grid-cols-2"><TextField label="Official application ID" value={officialId} onChange={(event) => setOfficialId(event.target.value)} disabled={!hasFrozenVersion} /><TextField label="Submission date and time" type="datetime-local" value={submittedAt} onChange={(event) => setSubmittedAt(event.target.value)} disabled={!hasFrozenVersion} /></div><Button className="mt-4" onClick={onRecordSubmission} loading={recordSubmission.isPending} disabled={!hasFrozenVersion}>Record submission</Button></>}
      </section>

      <section className="mt-10 grid gap-10 xl:grid-cols-[0.72fr_1.28fr]">
        <div><p className="eyebrow">Add an update</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Record what happened next</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">Add a note after checking the official portal or receiving an update from the authority.</p><div className="mt-5 border-y border-[var(--rule-strong)] py-5"><ErrorBanner message={eventError} /><label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">Update type</span><select className="w-full rounded-[var(--radius)] border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2" value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="STATUS_CHECKED">Status checked</option><option value="RETURNED">Application returned</option><option value="REJECTED">Application rejected</option><option value="APPROVED">Application approved</option><option value="OTHER">Other update</option></select></label><div className="mt-4"><TextField label="Details" value={eventNote} onChange={(event) => setEventNote(event.target.value)} /></div><Button className="mt-4" onClick={onAddEvent} loading={addTimelineEvent.isPending}>Add to history</Button></div></div>
        <div id="history"><p className="eyebrow">History</p><h2 className="mt-2 font-display text-2xl text-[var(--ink)]">Application timeline</h2>{timeline.length === 0 ? <div className="mt-5 border-y border-dashed border-[var(--rule-strong)] py-8 text-sm text-[var(--ink-2)]">No submission events have been recorded.</div> : <ol className="mt-5 border-y border-[var(--rule-strong)]">{[...timeline].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).map((event, index) => <li key={event.eventId} className="grid grid-cols-[44px_1fr] gap-4 border-b border-[var(--rule)] py-5 last:border-b-0"><span className="font-mono text-xs text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold text-[var(--ink)]">{event.eventType.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</p><p className="mt-1 font-mono text-xs text-[var(--ink-2)]">{new Date(event.occurredAt).toLocaleString()} · {event.actor}</p>{Object.keys(event.payload ?? {}).length ? <p className="mt-2 text-sm text-[var(--ink-2)]">{String(event.payload.note ?? JSON.stringify(event.payload))}</p> : null}</div></li>)}</ol>}</div>
      </section>
    </div>
  );
}
