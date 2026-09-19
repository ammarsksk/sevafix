"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import { StatusChip } from "@/components/ui";
import { useApplication } from "@/lib/sevafix/queries";
import { lifecycleChip } from "@/lib/status";

const tabs = [
  { segment: "edit", label: "Draft" },
  { segment: "documents", label: "Documents" },
  { segment: "check", label: "Check" },
  { segment: "review", label: "Review & freeze" },
  { segment: "tracking", label: "Tracking" },
  { segment: "diagnose", label: "Diagnose" },
];

function ApplicationTabs({ appId }: { appId: string }) {
  const pathname = usePathname();
  const application = useApplication(appId);

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">
          {application.data?.application.schemeId ?? "Application"}
        </h1>
        {application.data ? (
          <StatusChip spec={lifecycleChip(application.data.application.lifecycleStatus)} />
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const href = `/applications/${appId}/${tab.segment}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.segment}
              href={href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const appId = params.id;

  return (
    <ProtectedRoute>
      <ApplicationTabs appId={appId} />
      {children}
    </ProtectedRoute>
  );
}
