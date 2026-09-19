"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import { Button, Card, ErrorBanner, FullPageSpinner, PageHeader, TextField } from "@/components/ui";
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

  const matchingApplications = useMemo(
    () => (applications.data?.items ?? []).filter((application) => application.schemeId === selectedSchemeId),
    [applications.data?.items, selectedSchemeId],
  );
  const selectedExistingApplicationId = matchingApplications.some((item) => item.appId === existingApplicationId)
    ? existingApplicationId
    : (matchingApplications[0]?.appId ?? "");

  if (schemes.isLoading || applications.isLoading) return <FullPageSpinner />;

  async function onContinue() {
    setError(null);
    if (!selectedSchemeId) {
      setError("Select the government scheme.");
      return;
    }
    if (sourceApplication === "SEVAFIX" && !selectedExistingApplicationId) {
      setError("Select the SevaFix application that was rejected or returned.");
      return;
    }
    if (sourceApplication === "EXTERNAL" && !officialApplicationId.trim()) {
      setError("Enter the official application ID.");
      return;
    }
    try {
      const application = await openGrievance.mutateAsync({
        schemeId: selectedSchemeId,
        sourceApplication,
        ...(rejectionReason.trim() ? { rejectionReason: rejectionReason.trim() } : {}),
        ...(sourceApplication === "SEVAFIX"
          ? { existingApplicationId: selectedExistingApplicationId }
          : {
              officialApplicationId: officialApplicationId.trim(),
              ...(submittedAt ? { submittedAt: new Date(submittedAt).toISOString() } : {}),
            }),
      });
      router.push(`/applications/${application.appId}/diagnose`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the grievance");
    }
  }

  return (
    <div>
      <PageHeader
        title="Diagnose a failed application"
        description="Use this section for an application that was rejected or returned, whether or not it was created in SevaFix."
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <ErrorBanner message={error} />
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium text-slate-800">Where was the application prepared?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSourceApplication("EXTERNAL")}
                className={`rounded-md border p-3 text-left text-sm ${sourceApplication === "EXTERNAL" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
              >
                <span className="block font-medium">Outside SevaFix</span>
                <span className="text-xs text-slate-500">Import an already submitted application.</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceApplication("SEVAFIX")}
                className={`rounded-md border p-3 text-left text-sm ${sourceApplication === "SEVAFIX" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
              >
                <span className="block font-medium">Inside SevaFix</span>
                <span className="text-xs text-slate-500">Use one of your existing applications.</span>
              </button>
            </div>
          </fieldset>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Government scheme</span>
            <select
              aria-label="Government scheme"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedSchemeId}
              onChange={(event) => {
                setSchemeId(event.target.value);
                setExistingApplicationId("");
              }}
            >
              {(schemes.data?.items ?? []).map((scheme) => (
                <option key={scheme.schemeId} value={scheme.schemeId}>{scheme.name}</option>
              ))}
            </select>
          </label>

          {sourceApplication === "SEVAFIX" ? (
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-800">Existing SevaFix application</span>
              <select
                aria-label="Existing SevaFix application"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={selectedExistingApplicationId}
                onChange={(event) => setExistingApplicationId(event.target.value)}
              >
                {matchingApplications.length === 0 ? <option value="">No applications found for this scheme</option> : null}
                {matchingApplications.map((application) => (
                  <option key={application.appId} value={application.appId}>
                    {application.appId} — {application.lifecycleStatus.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <TextField
                label="Official application ID"
                value={officialApplicationId}
                onChange={(event) => setOfficialApplicationId(event.target.value)}
                autoComplete="off"
              />
              <TextField
                label="Original submission date"
                type="datetime-local"
                value={submittedAt}
                onChange={(event) => setSubmittedAt(event.target.value)}
              />
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Rejection reason, if one was provided</span>
            <textarea
              aria-label="Rejection reason"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              rows={5}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Paste the portal message or describe the reason shown by the authority"
            />
            <span className="mt-1 block text-xs text-slate-500">Optional. If the authority gave no reason, SevaFix will infer likely issues from the scheme checks and uploaded evidence.</span>
          </label>

          <Button className="mt-5 w-full" onClick={onContinue} loading={openGrievance.isPending}>
            Continue to AI diagnosis
          </Button>
        </Card>

        <Card className="h-fit bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">What happens next?</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-600">
            <li>Upload the rejection notice and submitted evidence.</li>
            <li>AI compares them with the selected scheme policy.</li>
            <li>SevaFix explains the likely failure with source citations.</li>
            <li>Start a corrected application using the diagnosis.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

export default function GrievancesPage() {
  return (
    <ProtectedRoute>
      <GrievanceContent />
    </ProtectedRoute>
  );
}
