"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Button, Card, ErrorBanner, FullPageSpinner, TextField } from "@/components/ui";
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

  if (application.isLoading) return <FullPageSpinner />;

  const app = application.data?.application;
  const timeline = application.data?.timeline ?? [];
  const hasFrozenVersion = (application.data?.versions.length ?? 0) > 0;

  async function onRecordSubmission() {
    setSubmissionError(null);
    if (!officialId || !submittedAt) {
      setSubmissionError("Enter both the official application ID and submission date.");
      return;
    }
    try {
      await recordSubmission.mutateAsync({
        officialApplicationId: officialId,
        submittedAt: new Date(submittedAt).toISOString(),
      });
      setOfficialId("");
      setSubmittedAt("");
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Could not record submission");
    }
  }

  async function onAddEvent() {
    setEventError(null);
    if (!eventType) {
      setEventError("Enter an event type.");
      return;
    }
    try {
      await addTimelineEvent.mutateAsync({ eventType, payload: { note: eventNote } });
      setEventNote("");
    } catch (err) {
      setEventError(err instanceof Error ? err.message : "Could not add event");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Manual submission</h2>
        {app?.officialApplicationIdDisplay ? (
          <p className="text-sm text-slate-700">
            Recorded: <span className="font-medium">{app.officialApplicationIdDisplay}</span> on{" "}
            {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "—"}
          </p>
        ) : (
          <>
            {!hasFrozenVersion ? (
              <ErrorBanner message="Freeze at least one version on the Review tab before recording submission." />
            ) : null}
            <ErrorBanner message={submissionError} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Official application ID"
                value={officialId}
                onChange={(e) => setOfficialId(e.target.value)}
                disabled={!hasFrozenVersion}
              />
              <TextField
                label="Submitted at"
                type="datetime-local"
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
                disabled={!hasFrozenVersion}
              />
            </div>
            <Button
              className="mt-4"
              onClick={onRecordSubmission}
              loading={recordSubmission.isPending}
              disabled={!hasFrozenVersion}
            >
              Record submission
            </Button>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add timeline event</h2>
        <ErrorBanner message={eventError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)} />
          <TextField label="Details" value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
        </div>
        <Button className="mt-4" onClick={onAddEvent} loading={addTimelineEvent.isPending}>
          Add event
        </Button>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No events recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {[...timeline]
              .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
              .map((event) => (
                <li key={event.eventId} className="border-l-2 border-slate-300 pl-3">
                  <p className="text-sm font-medium text-slate-900">{event.eventType}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(event.occurredAt).toLocaleString()} · {event.actor}
                  </p>
                  {Object.keys(event.payload ?? {}).length > 0 ? (
                    <p className="mt-1 text-xs text-slate-600">{JSON.stringify(event.payload)}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
