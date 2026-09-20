"use client";

import { AppIcon } from "@/components/icons";
import { ProtectedRoute } from "@/components/route-guards";
import { ErrorBanner, FullPageSpinner, InlineLink, PageHeader } from "@/components/ui";
import { useSchemes } from "@/lib/sevafix/queries";

function SchemesContent() {
  const schemes = useSchemes();
  if (schemes.isLoading) return <FullPageSpinner label="Loading supported schemes…" />;

  return (
    <div>
      <PageHeader eyebrow="Scheme directory" title="Supported schemes" description="Application preparation becomes available only after official sources, policy claims, and checks have been reviewed." />
      <ErrorBanner message={schemes.error instanceof Error ? schemes.error.message : null} />
      <div className="border-y border-[#cfd5dc] bg-white">
        {schemes.data?.items.map((scheme) => {
          const ready = scheme.applicationReady !== false;
          return (
            <article key={scheme.schemeId} className="grid gap-5 border-b border-[#dfe3e8] p-5 last:border-b-0 sm:p-7 lg:grid-cols-[1.25fr_0.75fr_auto] lg:items-start">
              <div><div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#edf3f9] text-[#173f73]"><AppIcon name="file" size={18} /></span><div><h2 className="text-lg font-semibold tracking-[-0.02em] text-[#172033]">{scheme.name}</h2><p className="mt-1 text-xs text-[#7b8492]">{scheme.schemeId}</p></div></div>{scheme.disclaimer ? <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5f6878]">{scheme.disclaimer}</p> : null}</div>
              <dl className="text-sm"><div><dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5f6878]">Support status</dt><dd className={`mt-1 font-semibold ${ready ? "text-[#216247]" : "text-[#855916]"}`}>{ready ? "Ready" : scheme.catalogStatus === "POLICY_ONBOARDING" ? "Policy onboarding" : "Official portal only"}</dd></div><div className="mt-4"><dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5f6878]">Application period</dt><dd className="mt-1 text-[#344054]">Check the official portal for current dates</dd></div>{scheme.activePolicyVersionId ? <div className="mt-4"><dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5f6878]">Policy version</dt><dd className="mt-1 text-[#344054]">{scheme.activePolicyVersionId}</dd></div> : null}</dl>
              <div className="flex flex-col items-start gap-3 lg:items-end">{ready ? <InlineLink href={`/applications/new?schemeId=${encodeURIComponent(scheme.schemeId)}`}>Start application</InlineLink> : <span className="rounded-[4px] border border-amber-200 bg-[#fff6e6] px-2 py-1 text-xs font-semibold text-[#855916]">Not available yet</span>}{scheme.officialPortalUrl ? <a href={scheme.officialPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#5f6878] underline hover:text-[#173f73]">Official portal <AppIcon name="external" size={14} /></a> : <span className="text-xs text-[#7b8492]">Official link not provided</span>}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
export default function SchemesPage() { return <ProtectedRoute><SchemesContent /></ProtectedRoute>; }

