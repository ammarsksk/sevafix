"use client";

import Link from "next/link";

import { ProtectedRoute } from "@/components/route-guards";
import { Button, Card, ErrorBanner, FullPageSpinner, PageHeader, StatusChip } from "@/components/ui";
import { useApplications, useMe } from "@/lib/sevafix/queries";
import { lifecycleChip } from "@/lib/status";

function DashboardContent() {
  const me = useMe();
  const applications = useApplications();

  if (me.isLoading || applications.isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title={`Welcome${me.data?.displayName ? `, ${me.data.displayName}` : ""}`}
        description="Choose whether you want to prepare a new application or diagnose one that has already failed."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card className="border-orange-200 bg-orange-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Journey 1</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Diagnose a failed application</h2>
          <p className="mt-2 text-sm text-slate-600">Import an outside application or select a SevaFix application, then find out why it failed.</p>
          <Link href="/grievances"><Button className="mt-4">Report a grievance</Button></Link>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Journey 2</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Create a new application</h2>
          <p className="mt-2 text-sm text-slate-600">Choose a scheme, prepare the form, upload evidence and run checks before submitting.</p>
          <Link href="/schemes"><Button className="mt-4">Start from scratch</Button></Link>
        </Card>
      </div>

      {me.data?.profileStatus === "EMPTY" ? (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-800">
            Your profile is incomplete.{" "}
            <Link href="/settings" className="underline">
              Add your name and notification preferences
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <ErrorBanner message={applications.error instanceof Error ? applications.error.message : null} />

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Your applications and grievances</h2>
      {applications.data?.items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            You have not started an application yet.{" "}
            <Link href="/schemes" className="underline">
              Browse supported schemes
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.data?.items.map((app) => {
            const chip = lifecycleChip(app.lifecycleStatus);
            return (
              <Link
                key={app.appId}
                href={`/applications/${app.appId}/${app.journeyType === "GRIEVANCE" ? "diagnose" : "edit"}`}
              >
                <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{app.schemeId}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {app.journeyType === "GRIEVANCE" ? "Grievance" : "Application"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Updated {new Date(app.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusChip spec={chip} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
