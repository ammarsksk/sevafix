"use client";

import { useState } from "react";

import styles from "./lab.module.css";

export function DiagnosisExplorer() {
  const [view, setView] = useState<"diagnosis" | "repair">("diagnosis");
  const [authorityReason, setAuthorityReason] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [citationActive, setCitationActive] = useState(false);

  return (
    <div className={styles.sheet}>
      <div className={styles.diagnosisControls}>
        <div className={styles.segments} aria-label="Diagnosis views">
          <button type="button" onClick={() => setView("diagnosis")} className={`${styles.segmentButton} ${view === "diagnosis" ? styles.segmentActive : ""}`} aria-pressed={view === "diagnosis"}>Diagnosis</button>
          <button type="button" onClick={() => setView("repair")} className={`${styles.segmentButton} ${view === "repair" ? styles.segmentActive : ""}`} aria-pressed={view === "repair"}>Repair view</button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <label className={styles.toggleLabel}><input type="checkbox" checked={authorityReason} onChange={(event) => setAuthorityReason(event.target.checked)} /> Authority gave a reason</label>
          <label className={styles.toggleLabel}><input type="checkbox" checked={aiUnavailable} onChange={(event) => setAiUnavailable(event.target.checked)} /> AI unavailable</label>
        </div>
      </div>

      {view === "diagnosis" ? (
        <div className={styles.diagnosisGrid}>
          <div className={styles.diagnosisMain}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rule)] pb-5">
              <div><p className={styles.meta}>DIAGNOSIS · APPLICATION VERSION 1</p><h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-[-0.025em]">Income information does not agree</h3></div>
              <span className="text-sm font-semibold text-[var(--review)]">{authorityReason ? "Reported by the authority" : "Inferred by SevaFix"}</span>
            </div>

            <p className="mt-6 leading-7 text-[var(--ink-2)]">
              {authorityReason ? "The return reason mentions an income mismatch." : "No reason was supplied by the authority. SevaFix found a mismatch in the preserved application evidence."} {aiUnavailable ? "This result was checked by rules only." : "The explanation is limited to the failed check and reviewed source below."}
            </p>

            <div className={`mt-7 border-y border-[var(--rule-strong)] py-5 transition-colors ${citationActive ? "bg-[var(--evidence)]" : ""}`}>
              <div className="flex items-center gap-3"><span className={`${styles.mark} ${styles.fail}`}>×</span><div><p className="font-semibold">Declared income must match the uploaded certificate</p><p className="mt-1 text-sm text-[var(--ink-2)]">Blocking deterministic check</p></div></div>
              <dl className={`${styles.anatomy} mt-4`}>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On the submitted form</dt><dd className="font-mono">₹4,20,000</dd></div>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On the certificate</dt><dd className="font-mono">₹4,80,000</dd></div>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>What to change</dt><dd>Correct the form value or replace the certificate with the evidence used for the application.</dd></div>
              </dl>
            </div>

            <div className="mt-6 flex items-start gap-2 text-sm leading-6"><a href="#diagnosis-source-1" className={`${styles.citation} ${citationActive ? styles.citationActive : ""}`} onMouseEnter={() => setCitationActive(true)} onMouseLeave={() => setCitationActive(false)} onFocus={() => setCitationActive(true)} onBlur={() => setCitationActive(false)}>[1]</a><p>PM-USP CSSS guidelines establish the income evidence requirement. The consistency comparison is SevaFix policy version 2026–27.3.</p></div>
            <p className="mt-6 border-l-2 border-[var(--rule-strong)] pl-4 text-sm leading-6 text-[var(--ink-2)]">This diagnosis does not change the authority’s decision. It prepares a focused correction while preserving the original version.</p>
          </div>

          <aside id="diagnosis-source-1" className={styles.diagnosisSource}>
            <p className={styles.kicker}>Source [1]</p>
            <h4 className="mt-3 font-semibold">PM-USP CSSS Guidelines</h4>
            <p className="mt-1 text-sm text-[var(--ink-2)]">Eligibility 4(v), page 2 · Department of Higher Education, Ministry of Education</p>
            <blockquote className={`${styles.sourcePassage} ${citationActive ? styles.sourceActive : ""}`}>Gross parental or family income must not exceed ₹4,50,000 per annum. An income certificate is required for fresh applicants.</blockquote>
            <dl className="mt-6 border-t border-[var(--rule)] text-sm"><div className="border-b border-[var(--rule)] py-3"><dt className={styles.anatomyTerm}>Policy version</dt><dd className="mt-1 font-mono text-xs">pm-usp-csss-2026-27.3</dd></div><div className="border-b border-[var(--rule)] py-3"><dt className={styles.anatomyTerm}>Explanation mode</dt><dd className="mt-1">{aiUnavailable ? "Checked by rules only" : "Constrained explanation with validated citation"}</dd></div></dl>
            <a href="https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_07022024_updated.pdf" target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-semibold text-[var(--accent)] underline">Open official source ↗</a>
          </aside>
        </div>
      ) : (
        <div>
          <div className="border-b border-[var(--rule)] px-5 py-5 sm:px-7"><p className={styles.meta}>REPAIR CASE · VERSION 1 PRESERVED</p><h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-[-0.025em]">Review the focused correction</h3></div>
          <div className={styles.repairGrid}>
            <div className={styles.repairVersion}><p className={styles.kicker}>Original · Version 1</p><dl className="mt-6 border-t border-[var(--rule-strong)]"><div className="border-b border-[var(--rule)] py-4"><dt className={styles.anatomyTerm}>Family annual income</dt><dd className="mt-1 font-mono text-lg">₹4,20,000</dd></div><div className="border-b border-[var(--rule)] py-4"><dt className={styles.anatomyTerm}>Supporting certificate</dt><dd className="mt-1">Income certificate · preserved</dd></div></dl><p className="mt-5 text-sm text-[var(--ink-2)]">This submitted version cannot be edited.</p></div>
            <div className={styles.repairVersion}><p className={styles.kicker}>Correction · Draft version 2</p><dl className="mt-6 border-t border-[var(--rule-strong)]"><div className={`border-b border-[var(--rule)] py-4 ${styles.changed}`}><dt className={styles.anatomyTerm}>Family annual income · changed</dt><dd className="mt-1 font-mono text-lg">₹4,80,000</dd></div><div className="border-b border-[var(--rule)] py-4"><dt className={styles.anatomyTerm}>Supporting certificate</dt><dd className="mt-1">Income certificate · unchanged</dd></div></dl><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--pass)]"><span className={`${styles.mark} ${styles.pass}`}>✓</span> Values now agree</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
