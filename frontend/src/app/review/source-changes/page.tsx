"use client";

import { useState } from "react";

import { ReviewerRoute } from "@/components/route-guards";
import {
  Button,
  Card,
  ConfirmModal,
  ErrorBanner,
  FullPageSpinner,
  PageHeader,
  StatusChip,
  TextField,
} from "@/components/ui";
import { useApproveSourceChange, useRejectSourceChange, useSourceChanges } from "@/lib/sevafix/queries";
import { reviewStateChip } from "@/lib/status";

function SourceChangesContent() {
  const sourceChanges = useSourceChanges();
  const approve = useApproveSourceChange();
  const reject = useRejectSourceChange();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (sourceChanges.isLoading) return <FullPageSpinner />;

  const items = sourceChanges.data?.items ?? [];

  async function onApprove(changeId: string) {
    setError(null);
    try {
      await approve.mutateAsync(changeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve change");
    }
  }

  async function onConfirmReject() {
    if (!rejectingId) return;
    setError(null);
    try {
      await reject.mutateAsync({ changeId: rejectingId, reason });
      setRejectingId(null);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject change");
    }
  }

  return (
    <div>
      <PageHeader
        title="Source changes"
        description="Review detected changes to official scheme sources before they affect policy."
      />
      <ErrorBanner message={error} />

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No source changes are pending review.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((change) => (
            <Card key={change.changeId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{change.title ?? change.sourceId}</p>
                  {change.sourceUrl ? (
                    <a
                      href={change.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 underline"
                    >
                      {change.sourceUrl}
                    </a>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Detected {change.detectedAt ? new Date(change.detectedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <StatusChip spec={reviewStateChip(change.reviewState)} />
              </div>
              {change.reviewState === "CHANGED" ? (
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => onApprove(change.changeId)} loading={approve.isPending}>
                    Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setRejectingId(change.changeId)}>
                    Reject
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {rejectingId ? (
        <ConfirmModal
          title="Reject source change"
          description={
            <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          }
          confirmLabel="Reject"
          danger
          onConfirm={onConfirmReject}
          onClose={() => {
            setRejectingId(null);
            setReason("");
          }}
          busy={reject.isPending}
        />
      ) : null}
    </div>
  );
}

export default function SourceChangesPage() {
  return (
    <ReviewerRoute>
      <SourceChangesContent />
    </ReviewerRoute>
  );
}
