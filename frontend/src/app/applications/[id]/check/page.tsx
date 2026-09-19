"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Card, ErrorBanner, FullPageSpinner, StatusChip } from "@/components/ui";
import { useApplication, useValidate } from "@/lib/sevafix/queries";
import { waitForJob } from "@/lib/sevafix/sevafix-api";
import { checkStatusChip, readinessChip } from "@/lib/status";

const POLL_TIMEOUT_MS = 90_000;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run validation");
    } finally {
      setPolling(false);
    }
  }

  if (application.isLoading) return <FullPageSpinner />;

  const readiness = application.data?.application.readinessSummary;
  const latestRunId = application.data?.application.lastValidationRunId;
  const checks = (application.data?.checks ?? []).filter((check) => !latestRunId || check.runId === latestRunId);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Readiness</h2>
            {readiness ? (
              <div className="mt-2 flex items-center gap-3">
                <StatusChip spec={readinessChip(readiness.label)} />
                <span className="text-xs text-slate-500">
                  {readiness.passed} passed · {readiness.failed} failed · {readiness.needsReview} need
                  review · {readiness.blocked} blocked
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No validation has been run yet.</p>
            )}
          </div>
          <Button onClick={onRunValidation} loading={polling}>
            Run validation
          </Button>
        </div>
        <ErrorBanner message={error} />
      </Card>

      <div className="space-y-3">
        {checks.map((check) => (
          <Card key={check.ruleId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{check.ruleId}</p>
                <p className="mt-1 text-sm text-slate-600">{check.message}</p>
                {check.missingEvidence?.length ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Missing evidence: {check.missingEvidence.join(", ")}
                  </p>
                ) : null}
              </div>
              <StatusChip spec={checkStatusChip(check.status)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
