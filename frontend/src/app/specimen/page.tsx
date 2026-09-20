import Link from "next/link";

type MarkKind = "pass" | "fail" | "review" | "missing" | "na" | "stale";

const statusRows: Array<{
  kind: MarkKind;
  label: string;
  code: string;
  example: string;
}> = [
  { kind: "pass", label: "Passed", code: "PASS", example: "Name matches the identity evidence." },
  { kind: "fail", label: "Needs fixing", code: "FAIL", example: "Income differs between form and certificate." },
  { kind: "review", label: "Needs review", code: "NEEDS_REVIEW", example: "The extracted value has low confidence." },
  { kind: "missing", label: "Missing evidence", code: "BLOCKED_MISSING_EVIDENCE", example: "Income certificate has not been added." },
  { kind: "na", label: "Not applicable", code: "NOT_APPLICABLE", example: "Renewal attendance rule does not apply to fresh applications." },
  { kind: "stale", label: "Policy source outdated", code: "BLOCKED_SOURCE_STALE", example: "The official source changed and awaits review." },
];

function StatusMark({ kind }: { kind: MarkKind }) {
  const symbol = { pass: "✓", fail: "×", review: "◐", missing: "", na: "—", stale: "" }[kind];
  return <span aria-hidden="true" className={`specimen-status-mark specimen-status-${kind}`}>{symbol}</span>;
}

export const metadata = {
  title: "Design specimen",
  robots: { index: false, follow: false },
};

export default function SpecimenPage() {
  return (
    <div className="specimen-page bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule-strong)]">
        <div className="mx-auto max-w-[1360px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">00 / Foundation specimen</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <h1 className="font-[family-name:var(--font-display)] text-5xl font-medium leading-[0.96] tracking-[-0.045em] sm:text-7xl">The case file, before the case.</h1>
            <div className="max-w-2xl lg:pt-3">
              <p className="text-lg leading-8 text-[var(--ink-2)]">A document-led interface for preparing and repairing government scheme applications. The system shows its evidence, distinguishes rules from explanation, and claims no authority.</p>
              <p className="mt-6 border-l-2 border-[var(--accent)] pl-4 text-sm leading-6 text-[var(--ink-2)]">Independent workspace. Not a government website. You submit on the official portal.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-[var(--rule)]" aria-labelledby="rationale-heading">
        <div className="mx-auto grid max-w-[1360px] lg:grid-cols-[0.34fr_0.66fr]">
          <div className="border-b border-[var(--rule)] px-5 py-12 sm:px-8 lg:border-b-0 lg:border-r lg:px-12">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Design rationale</p>
            <h2 id="rationale-heading" className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-none tracking-[-0.035em]">A quiet, inspectable record.</h2>
          </div>
          <dl className="divide-y divide-[var(--rule)]">
            <div className="grid gap-3 px-5 py-7 sm:grid-cols-[10rem_1fr] sm:px-8 lg:px-12"><dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)]">Hierarchy</dt><dd className="max-w-2xl leading-7">Serif carries questions and decisions. Grotesk carries actions and guidance. Mono carries evidence IDs, versions, dates, and amounts.</dd></div>
            <div className="grid gap-3 px-5 py-7 sm:grid-cols-[10rem_1fr] sm:px-8 lg:px-12"><dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)]">Structure</dt><dd className="max-w-2xl leading-7">Hairlines, ledgers, margins, and document sheets replace generic cards. Every region has a job and a visible relationship to its evidence.</dd></div>
            <div className="grid gap-3 px-5 py-7 sm:grid-cols-[10rem_1fr] sm:px-8 lg:px-12"><dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)]">Signature</dt><dd className="max-w-2xl leading-7">Marginalia explains why a field is asked or points to the reviewed source. On mobile it becomes an inline note immediately after the relevant content.</dd></div>
          </dl>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]" aria-labelledby="type-heading">
        <div className="mx-auto max-w-[1360px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">01 / Type and colour</p>
          <h2 id="type-heading" className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-[-0.035em]">A narrow palette with clear roles.</h2>

          <div className="mt-10 grid border-y border-[var(--rule-strong)] lg:grid-cols-[1fr_1fr]">
            <div className="border-b border-[var(--rule)] py-8 lg:border-b-0 lg:border-r lg:pr-10">
              <p className="font-[family-name:var(--font-display)] text-5xl leading-[0.98] tracking-[-0.035em]">Get the application right. Or find out why it wasn’t.</p>
              <p className="mt-5 text-base leading-7 text-[var(--ink-2)]">Newsreader for decisions and long-form evidence. Hanken Grotesk for interface language people need to act on.</p>
              <p className="mt-7 font-mono text-xs uppercase tracking-[0.12em]">PM-USP-CSSS · 2026–27.3 · ₹4,50,000</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2">
              {[
                ["Paper", "#F5F2EA", "var(--paper)"],
                ["Ink", "#16191C", "var(--ink)"],
                ["Action", "#0E4F4B", "var(--accent)"],
                ["Evidence", "#F4E3A1", "var(--evidence)"],
              ].map(([name, hex, color]) => <div key={name} className="border-l border-t border-[var(--rule)] p-5 first:border-l-0 sm:first:border-l lg:nth-[1]:border-t-0 lg:nth-[2]:border-t-0"><span className="block h-12 w-full border border-black/10" style={{ background: color }} /><span className="mt-3 block text-sm font-semibold">{name}</span><span className="font-mono text-xs text-[var(--ink-2)]">{hex}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]" aria-labelledby="status-heading">
        <div className="mx-auto max-w-[1360px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
            <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">02 / Check language</p><h2 id="status-heading" className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-[-0.035em]">Six states. No colour-only meaning.</h2></div>
            <p className="max-w-xl leading-7 text-[var(--ink-2)]">Each mark keeps its shape in print, high-contrast modes, and monochrome. The human label is always present beside the backend state.</p>
          </div>
          <div className="mt-10 border-t border-[var(--rule-strong)]">
            {statusRows.map((status) => (
              <div key={status.code} tabIndex={0} className="status-specimen-row grid gap-3 border-b border-[var(--rule)] py-5 outline-none sm:grid-cols-[2rem_10rem_1fr_16rem] sm:items-center">
                <StatusMark kind={status.kind} />
                <span className="font-semibold">{status.label}</span>
                <span className="text-sm text-[var(--ink-2)]">{status.example}</span>
                <span className="font-mono text-[0.72rem] text-[var(--neutral)] sm:text-right">{status.code}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]" aria-labelledby="controls-heading">
        <div className="mx-auto grid max-w-[1360px] lg:grid-cols-[0.38fr_0.62fr]">
          <div className="border-b border-[var(--rule)] px-5 py-14 sm:px-8 lg:border-b-0 lg:border-r lg:px-12 lg:py-20">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">03 / Controls</p>
            <h2 id="controls-heading" className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-[-0.035em]">Plain actions, explicit consequences.</h2>
            <div className="mt-9 flex flex-wrap gap-3">
              <button type="button" className="specimen-button specimen-button-primary">Save and continue</button>
              <button type="button" className="specimen-button specimen-button-secondary">Save draft</button>
              <button type="button" className="specimen-button specimen-button-text">Cancel</button>
            </div>
          </div>
          <div className="px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
            <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
              <div>
                <label htmlFor="income-specimen" className="block text-sm font-semibold">Gross annual family income</label>
                <p id="income-help" className="mt-1 text-sm text-[var(--ink-2)]">Enter the amount shown on the family income certificate.</p>
                <div className="mt-3 flex max-w-md border border-[var(--rule-strong)] bg-[var(--sheet)] focus-within:border-[var(--accent)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
                  <span className="grid min-h-12 w-12 place-items-center border-r border-[var(--rule)] font-mono text-sm">₹</span>
                  <input id="income-specimen" aria-describedby="income-help" inputMode="numeric" defaultValue="4,20,000" className="min-h-12 min-w-0 flex-1 bg-transparent px-4 font-mono outline-none" />
                </div>
                <p className="mt-3 text-sm text-[var(--fail)]">This value does not match the income certificate.</p>
              </div>
              <aside className="border-l-2 border-[var(--rule)] pl-5 text-sm leading-6 text-[var(--ink-2)]">
                <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">Why we ask</p>
                <p className="mt-2">This value is compared with the certificate and the reviewed scheme rule. It is not used to promise selection.</p>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--rule)] bg-[var(--sheet)]" aria-labelledby="evidence-heading">
        <div className="mx-auto max-w-[1360px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">04 / Evidence</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[0.68fr_0.32fr]">
            <div>
              <h2 id="evidence-heading" className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.035em]">Citations stay beside the claim.</h2>
              <blockquote className="mt-8 border-y border-[var(--rule-strong)] py-8 font-[family-name:var(--font-display)] text-2xl leading-9">
                Gross parental or family income must be <mark className="bg-[var(--evidence)] px-1 text-inherit">no more than ₹4,50,000 per year</mark> for a fresh application.<sup><a href="#source-note" className="ml-1 font-mono text-xs text-[var(--accent)] underline">[1]</a></sup>
              </blockquote>
              <p id="source-note" className="mt-5 max-w-3xl text-sm leading-6 text-[var(--ink-2)]"><span className="font-mono text-xs text-[var(--accent)]">[1]</span> PM-USP CSSS Guidelines, Eligibility 4(v), page 2. Department of Higher Education, Ministry of Education. Reviewed in policy version <span className="font-mono text-xs">pm-usp-csss-2026-27.3</span>.</p>
            </div>
            <aside className="border-l border-[var(--rule)] pl-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">Marginalia</p>
              <p className="mt-4 text-sm leading-6 text-[var(--ink-2)]">Highlight means evidence, not decoration. It is reserved for source passages and extracted values that require confirmation.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]" aria-labelledby="records-heading">
        <div className="mx-auto max-w-[1360px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">05 / Records</p>
          <h2 id="records-heading" className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-[-0.035em]">A timeline and ledger, not a dashboard of tiles.</h2>

          <div className="mt-10 grid gap-14 xl:grid-cols-[0.36fr_0.64fr]">
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)]">Application history</h3>
              <ol className="mt-5 border-t border-[var(--rule-strong)]">
                {[
                  ["19 Sep 2026", "Application version 1 frozen", "You"],
                  ["20 Sep 2026", "Submitted on the official portal", "You"],
                  ["28 Sep 2026", "Returned for correction", "Authority status recorded by you"],
                ].map(([date, event, actor], index) => <li key={event} className="relative grid grid-cols-[1rem_1fr] gap-4 border-b border-[var(--rule)] py-5"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${index === 2 ? "border-[var(--review)] bg-[var(--paper)]" : "border-[var(--accent)] bg-[var(--accent)]"}`} /><div><time className="font-mono text-[0.72rem] text-[var(--ink-2)]">{date}</time><p className="mt-1 font-semibold">{event}</p><p className="mt-1 text-sm text-[var(--ink-2)]">{actor}</p></div></li>)}
              </ol>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <caption className="mb-5 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)]">Application ledger</caption>
                <thead><tr className="border-y border-[var(--rule-strong)] font-mono text-[0.72rem] uppercase tracking-[0.08em] text-[var(--ink-2)]"><th className="py-3 pr-5 font-medium">Application</th><th className="px-5 py-3 font-medium">State</th><th className="px-5 py-3 font-medium">Updated</th><th className="py-3 pl-5 font-medium">Next action</th></tr></thead>
                <tbody>
                  <tr className="border-b border-[var(--rule)]"><td className="py-5 pr-5"><span className="block font-semibold">PM-USP CSSS</span><span className="mt-1 block font-mono text-[0.72rem] text-[var(--ink-2)]">APP · 7F2A</span></td><td className="px-5 py-5"><span className="inline-flex items-center gap-2 text-sm font-semibold"><StatusMark kind="review" /> Needs review</span></td><td className="px-5 py-5 font-mono text-xs">20 Sep 2026</td><td className="py-5 pl-5"><Link href="#" className="font-semibold text-[var(--accent)] underline decoration-[var(--rule-strong)] hover:decoration-[var(--accent)]">Confirm extracted income</Link></td></tr>
                  <tr className="border-b border-[var(--rule)]"><td className="py-5 pr-5"><span className="block font-semibold">PM-USP CSSS repair</span><span className="mt-1 block font-mono text-[0.72rem] text-[var(--ink-2)]">APP · 91BC · V2</span></td><td className="px-5 py-5"><span className="inline-flex items-center gap-2 text-sm font-semibold"><StatusMark kind="fail" /> Needs fixing</span></td><td className="px-5 py-5 font-mono text-xs">19 Sep 2026</td><td className="py-5 pl-5"><Link href="#" className="font-semibold text-[var(--accent)] underline decoration-[var(--rule-strong)] hover:decoration-[var(--accent)]">Review income mismatch</Link></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[var(--ink)] text-[var(--paper)]">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-5 px-5 py-8 text-sm sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <p>Foundation checkpoint complete. No application or policy authority is implied.</p>
          <Link href="/" className="font-semibold text-white underline decoration-white/40 hover:decoration-white">Return to current landing page</Link>
        </div>
      </footer>
    </div>
  );
}
