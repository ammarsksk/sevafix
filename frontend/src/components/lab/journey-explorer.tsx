"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./lab.module.css";

const steps = [
  ["Choose scheme", "Start with the reviewed scheme and application type."],
  ["Guided form", "Answer one clear section at a time."],
  ["Documents", "Add the evidence required for this application."],
  ["Confirm extracted values", "Review decisive values beside the document."],
  ["Checks", "See what passed, what needs attention, and why."],
  ["Review and freeze", "Preserve an immutable version before submission."],
  ["Submit on the official portal", "Leave SevaFix and submit to the authority."],
  ["Track", "Record the official reference and later status events."],
] as const;

function StepContent({ index }: { index: number }) {
  if (index === 0) return <div className="mt-7 border-y border-[var(--rule-strong)] py-5"><p className="font-semibold">PM-USP Central Sector Scholarship</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[var(--ink-2)]">Authority</dt><dd className="mt-1">Department of Higher Education</dd></div><div><dt className="text-[var(--ink-2)]">Policy version</dt><dd className="mt-1 font-mono text-xs">2026–27.3</dd></div></dl></div>;
  if (index === 1) return <div className={styles.marginalLayout}><div><label className={styles.fieldLabel} htmlFor="journey-name">Name as on Class XII marksheet</label><input id="journey-name" className={styles.input} defaultValue="Aditi Sharma" /><label className={`${styles.fieldLabel} mt-6`} htmlFor="journey-income">Gross annual family income</label><input id="journey-income" className={styles.input} defaultValue="4,20,000" /></div><aside className={styles.marginalia}><p className={styles.kicker}>Why we ask</p><p className="mt-2">The name is compared across evidence. Income is compared with the certificate and the rule pinned to this draft.</p></aside></div>;
  if (index === 2) return <div className="mt-7 border-y border-[var(--rule-strong)]"><div className="flex items-center justify-between gap-4 border-b border-[var(--rule)] py-4"><span><strong className="block">Family income certificate</strong><small className="text-[var(--ink-2)]">PDF · 184 KB</small></span><span className="text-sm font-semibold text-[var(--pass)]">Read</span></div><div className="flex items-center justify-between gap-4 py-4"><span><strong className="block">Class XII marksheet</strong><small className="text-[var(--ink-2)]">Not added</small></span><button type="button" className={styles.button}>Add document</button></div></div>;
  if (index === 3) return <div className={styles.marginalLayout}><div className={`${styles.sheet} mt-7 p-6`}><p className={styles.meta}>INCOME CERTIFICATE · PAGE 1</p><p className="mt-8 font-[family-name:var(--font-display)] text-xl leading-8">This is to certify that the gross annual family income is <span className={styles.evidenceUnderline}>₹4,80,000</span> for the relevant year.</p></div><aside className={styles.marginalia}><p className={styles.kicker}>Confidence 96%</p><p className="mt-2">This decisive value is below the 98% confirmation threshold. Check it against the document before continuing.</p><button type="button" className={`${styles.button} mt-4`}>Confirm value</button></aside></div>;
  if (index === 4) return <div className="mt-7"><div className={styles.checkRow}><span className={`${styles.mark} ${styles.pass}`}>✓</span><div><p className="font-semibold">Required details present</p><p className="mt-1 text-sm text-[var(--ink-2)]">All fields needed for this check are available.</p></div></div><div className={styles.checkRow}><span className={`${styles.mark} ${styles.fail}`}>×</span><div><p className="font-semibold">Income values agree</p><p className="mt-1 text-sm text-[var(--ink-2)]">Form: ₹4,20,000 · certificate: ₹4,80,000</p></div></div></div>;
  if (index === 5) return <div className={`${styles.sheet} mt-7 p-6`}><div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] pb-5"><div><p className={styles.meta}>APPLICATION VERSION</p><p className="mt-2 text-2xl font-semibold">Version 1</p></div><span className="font-mono text-xs">DRAFT</span></div><p className="mt-5 text-sm leading-6 text-[var(--ink-2)]">Freezing preserves the answers, documents, policy version, and check results used for this submission.</p><button type="button" className={`${styles.button} mt-5`}>Review freeze confirmation</button></div>;
  if (index === 6) return <div className="mt-7 border-y border-[var(--rule-strong)] py-6"><p className="text-lg font-semibold">National Scholarship Portal</p><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-2)]">You are leaving SevaFix. Sign in and submit directly on the official portal. SevaFix cannot submit for you.</p><a href="https://scholarships.gov.in/" target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--accent)] underline">Open official portal ↗</a></div>;
  return <div className="mt-7"><ol className="border-t border-[var(--rule-strong)]"><li className="grid grid-cols-[7rem_1fr] border-b border-[var(--rule)] py-4"><time className="font-mono text-xs">20 Sep 2026</time><span><strong className="block">Submitted</strong><small className="text-[var(--ink-2)]">Recorded by you · reference ending 7F2A</small></span></li><li className="grid grid-cols-[7rem_1fr] border-b border-[var(--rule)] py-4"><time className="font-mono text-xs">28 Sep 2026</time><span><strong className="block">Status checked</strong><small className="text-[var(--ink-2)]">Under review · recorded by you</small></span></li></ol></div>;
}

export function JourneyExplorer() {
  const [active, setActive] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number((visible.target as HTMLElement).dataset.step));
    }, { root: viewport, threshold: [0.35, 0.6] });
    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    setActive(index);
    stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.journeyLayout}>
      <nav className={styles.stepRail} aria-label="Prepare journey steps">
        {steps.map(([label], index) => <button key={label} type="button" aria-current={active === index ? "step" : undefined} onClick={() => goTo(index)} className={`${styles.stepButton} ${active === index ? styles.stepActive : ""}`}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span>{label}</span></button>)}
      </nav>
      <div ref={viewportRef} className={styles.journeyViewport} tabIndex={0} aria-label="Scrollable prepare journey">
        {steps.map(([label, description], index) => (
          <section key={label} ref={(node) => { stepRefs.current[index] = node; }} data-step={index} className={styles.journeyStep} aria-labelledby={`prepare-step-${index}`}>
            <p className={styles.kicker}>{String(index + 1).padStart(2, "0")} / Prepare</p>
            <h3 id={`prepare-step-${index}`} className={styles.stepTitle}>{label}</h3>
            <p className="mt-3 max-w-2xl leading-7 text-[var(--ink-2)]">{description}</p>
            <StepContent index={index} />
          </section>
        ))}
      </div>
    </div>
  );
}
