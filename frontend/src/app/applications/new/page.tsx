"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import { Button, Card, ErrorBanner, FullPageSpinner, PageHeader } from "@/components/ui";
import { useSchemes } from "@/lib/sevafix/queries";
import { useCreateApplication } from "@/lib/sevafix/queries";

function NewApplicationContent() {
  const searchParams = useSearchParams();
  const schemeId = searchParams.get("schemeId") ?? "";
  const schemes = useSchemes();
  const createApplication = useCreateApplication();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (schemes.isLoading) return <FullPageSpinner />;

  const scheme = schemes.data?.items.find((item) => item.schemeId === schemeId);

  if (!scheme) {
    return (
      <div>
        <PageHeader title="Start an application" />
        <ErrorBanner message="Choose a scheme first." />
        <Button className="mt-4" onClick={() => router.push("/schemes")}>
          Browse schemes
        </Button>
      </div>
    );
  }

  async function onCreate() {
    setError(null);
    try {
      const app = await createApplication.mutateAsync(scheme!.schemeId);
      router.push(`/applications/${app.appId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create application");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Start an application" description={scheme.name} />
      <Card>
        <ErrorBanner message={error} />
        {scheme.applicationReady === false ? (
          <>
            <p className="mb-4 text-sm text-amber-800">
              This scheme is listed for discovery, but its reviewed policy package is not ready in SevaFix yet.
            </p>
            <Button variant="secondary" onClick={() => router.push("/schemes")} className="w-full">
              Back to schemes
            </Button>
          </>
        ) : null}
        {scheme.disclaimer ? <p className="mb-4 text-sm text-slate-600">{scheme.disclaimer}</p> : null}
        <p className="mb-4 text-sm text-slate-600">
          SevaFix will help you prepare and check this application. You will still submit it
          yourself on the official government portal.
        </p>
        {scheme.applicationReady !== false ? (
          <Button onClick={onCreate} loading={createApplication.isPending} className="w-full">
            Create draft application
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <ProtectedRoute>
      <Suspense>
        <NewApplicationContent />
      </Suspense>
    </ProtectedRoute>
  );
}
