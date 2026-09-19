"use client";

import { ProtectedRoute } from "@/components/route-guards";
import { Card, ErrorBanner, FullPageSpinner, InlineLink, PageHeader } from "@/components/ui";
import { useSchemes } from "@/lib/sevafix/queries";

function SchemesContent() {
  const schemes = useSchemes();

  if (schemes.isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Create a new application"
        description="Choose a scheme to prepare an application from scratch. Only schemes with reviewed policies and executable checks are shown."
      />
      <ErrorBanner message={schemes.error instanceof Error ? schemes.error.message : null} />
      <div className="space-y-4">
        {schemes.data?.items.map((scheme) => (
          <Card key={scheme.schemeId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">{scheme.name}</h2>
                {scheme.disclaimer ? (
                  <p className="mt-1 max-w-xl text-sm text-slate-600">{scheme.disclaimer}</p>
                ) : null}
                {scheme.officialPortalUrl ? (
                  <a
                    href={scheme.officialPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-slate-500 underline"
                  >
                    Official government portal
                  </a>
                ) : null}
              </div>
              <InlineLink href={`/applications/new?schemeId=${encodeURIComponent(scheme.schemeId)}`}>
                Start application
              </InlineLink>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SchemesPage() {
  return (
    <ProtectedRoute>
      <SchemesContent />
    </ProtectedRoute>
  );
}
