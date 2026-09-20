"use client";

import { useMemo, useState } from "react";

import styles from "./lab.module.css";

const sample = {
  formIncome: "420000",
  formName: "Aditi Sharma",
  documentIncome: 480000,
  documentName: "Aditi Sharma",
};

type Result = {
  label: "Passed" | "Needs fixing" | "Missing evidence";
  tone: "pass" | "fail" | "missing";
  symbol: string;
  title: string;
  form: string;
  document: string;
  why: string;
  next: string;
};

export function LiveCheckSimulator() {
  const [income, setIncome] = useState(sample.formIncome);
  const [name, setName] = useState(sample.formName);
  const [hasIdentity, setHasIdentity] = useState(true);

  const results = useMemo<Result[]>(() => {
    const enteredIncome = Number(income.replaceAll(",", ""));
    const incomeMatches = Number.isFinite(enteredIncome) && enteredIncome === sample.documentIncome;
    const normalizedName = name.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
    const documentName = sample.documentName.toLocaleLowerCase("en-IN");

    return [
      {
        label: incomeMatches ? "Passed" : "Needs fixing",
        tone: incomeMatches ? "pass" : "fail",
        symbol: incomeMatches ? "✓" : "×",
        title: "Family annual income",
        form: Number.isFinite(enteredIncome) ? enteredIncome.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }) : "No valid amount",
        document: sample.documentIncome.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
        why: incomeMatches ? "The two values agree." : "The amount on the form differs from the certificate.",
        next: incomeMatches ? "No change needed." : "Correct the form or use the certificate that supports your answer.",
      },
      hasIdentity
        ? {
            label: normalizedName === documentName ? "Passed" : "Needs fixing",
            tone: normalizedName === documentName ? "pass" : "fail",
            symbol: normalizedName === documentName ? "✓" : "×",
            title: "Name consistency",
            form: name.trim() || "No name entered",
            document: sample.documentName,
            why: normalizedName === documentName ? "The names agree after spacing and case are normalized." : "The name does not match the identity evidence.",
            next: normalizedName === documentName ? "No change needed." : "Use the name shown on the identity evidence or add the correct document.",
          }
        : {
            label: "Missing evidence",
            tone: "missing",
            symbol: "",
            title: "Name consistency",
            form: name.trim() || "No name entered",
            document: "Identity evidence removed",
            why: "There is no document available for comparison.",
            next: "Add identity evidence before running this check.",
          },
    ];
  }, [hasIdentity, income, name]);

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <div><p className={styles.meta}>ILLUSTRATIVE SAMPLE · FICTIONAL APPLICANT</p><h3 className="mt-2 text-lg font-semibold">Application and evidence comparison</h3></div>
        <button type="button" className={styles.button} onClick={() => { setIncome(sample.formIncome); setName(sample.formName); setHasIdentity(true); }}>Reset</button>
      </div>

      <div className={styles.simulatorGrid}>
        <div className={styles.simulatorColumn}>
          <p className={styles.kicker}>On the application</p>
          <div className="mt-6">
            <label className={styles.fieldLabel} htmlFor="sample-income">Family annual income (₹)</label>
            <input id="sample-income" className={styles.input} inputMode="numeric" value={income} onChange={(event) => setIncome(event.target.value)} />
          </div>
          <div className="mt-6">
            <label className={styles.fieldLabel} htmlFor="sample-name">Name on form</label>
            <input id="sample-name" className={styles.input} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <label className={`${styles.toggleLabel} mt-5`}><input type="checkbox" checked={hasIdentity} onChange={(event) => setHasIdentity(event.target.checked)} /> Identity evidence included</label>
          <p className="mt-6 text-xs leading-5 text-[var(--ink-2)]">Nothing leaves your browser. This sample compares the form with fictional documents only; it does not decide eligibility.</p>
        </div>

        <div className={styles.simulatorColumn}>
          <p className={styles.kicker}>On the documents</p>
          <div className="mt-4">
            <div className={styles.documentLine}><span>Income certificate</span><strong className="font-mono">₹4,80,000</strong></div>
            <div className={styles.documentLine}><span>Identity evidence</span><strong>{hasIdentity ? sample.documentName : "Not added"}</strong></div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--rule-strong)] px-5 py-2 sm:px-7">
        <p className={`${styles.kicker} py-4`}>Checks update as you type</p>
        {results.map((result) => (
          <div key={result.title} className={styles.checkRow} aria-live="polite">
            <span className={`${styles.mark} ${styles[result.tone]}`}>{result.symbol}</span>
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{result.title}</p><p className={`text-sm font-semibold ${result.tone === "pass" ? "text-[var(--pass)]" : result.tone === "fail" ? "text-[var(--fail)]" : "text-[var(--review)]"}`}>{result.label}</p></div>
              <dl className={styles.anatomy}>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On your form</dt><dd>{result.form}</dd></div>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On your document</dt><dd>{result.document}</dd></div>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>Why they {result.tone === "pass" ? "match" : "do not match"}</dt><dd>{result.why}</dd></div>
                <div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>What to do next</dt><dd>{result.next}</dd></div>
              </dl>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
