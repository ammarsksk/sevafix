import Link from "next/link";

import { DiagnosisExplorer } from "@/components/lab/diagnosis-explorer";
import { EvidencePipelineDiagram } from "@/components/lab/evidence-pipeline-diagram";
import { JourneyExplorer } from "@/components/lab/journey-explorer";
import { LiveCheckSimulator } from "@/components/lab/live-check-simulator";
import { LandingAuthRedirect } from "@/components/landing-auth-redirect";
import { LandingSchemes } from "@/components/landing-schemes";

import styles from "./landing.module.css";

const copy = {
  heroTitle: "Get the application right. Or find out why it wasn’t.",
  heroBody: "Prepare a government scheme application against reviewed requirements and your own evidence. If an application is returned, trace the likely problem and create a focused correction without erasing the original.",
  problemTitle: "An applicant can follow every visible instruction and still not know what the system will compare.",
  prepareTitle: "Prepare with the evidence beside the answer.",
  diagnoseTitle: "Understand what failed before changing anything.",
  decisionTitle: "Rules produce the result. Evidence supports it. Explanation comes last.",
} as const;

const problems = [
  "Which version of a scheme rule applies to this application",
  "Whether the form and supporting documents say the same thing",
  "Which extracted values need human confirmation",
  "Whether a return reason came from the authority or is only an inference",
  "What can be corrected without rewriting the original submission",
];

const statuses = [
  ["pass", "✓", "Passed", "The application name matches the identity evidence.", "PASS"],
  ["fail", "×", "Needs fixing", "The form and certificate show different income values.", "FAIL"],
  ["review", "◐", "Needs review", "A decisive extracted value is below the confirmation threshold.", "NEEDS_REVIEW"],
  ["missing", "", "Missing evidence", "The required income certificate has not been added.", "BLOCKED_MISSING_EVIDENCE"],
  ["na", "—", "Not applicable", "A renewal rule does not apply to this fresh application.", "NOT_APPLICABLE"],
  ["stale", "", "Policy source outdated", "The official source changed and awaits review.", "BLOCKED_SOURCE_STALE"],
] as const;

const privacyItems = [
  ["Private document storage", "Citizen documents are stored privately and are not placed in public URLs or analytics."],
  ["Expiring document access", "Document viewing uses signed links that expire after three minutes. The links are refreshed, never persisted."],
  ["Encryption", "Application records and files use encrypted AWS storage in the Mumbai region."],
  ["Account protection", "Email sign-in supports optional authenticator-app multi-factor authentication."],
  ["Personal-data redaction", "Direct identifiers are removed before a constrained AI explanation is requested."],
  ["Audited policy changes", "Official-source changes enter a reviewer queue before a new rule version can be published."],
  ["Account deletion", "A deletion request queues removal of citizen documents and derived application data, then signs the user out."],
  ["Malware scanning", "Not yet active in the development environment. Uploaded files are not described as malware-scanned."],
];

export default function Home() {
  return (
    <div className={styles.landing}>
      <LandingAuthRedirect />

      <section aria-labelledby="home-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Independent application workspace</p>
            <h1 id="home-title" className={styles.heroTitle}>{copy.heroTitle}</h1>
            <p className={styles.heroSub}>{copy.heroBody}</p>

            <div className={styles.journeyLinks}>
              <Link href="/signup?intent=prepare" className={styles.journeyLink}><span className={styles.journeyLabel}>Preparing to apply</span><span className={styles.journeyAction}>Prepare an application →</span></Link>
              <Link href="/signup?intent=diagnose" className={styles.journeyLink}><span className={styles.journeyLabel}>Already rejected or returned</span><span className={styles.journeyAction}>Diagnose a rejection →</span></Link>
            </div>
            <p className={styles.microline}><span>Independent</span><span>·</span><span>You submit on the official portal</span><span>·</span><span>Your documents stay private</span></p>
          </div>
          <div className={styles.heroSimulator}><LiveCheckSimulator /></div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="problem-title">
        <div className={`${styles.container} ${styles.problemGrid}`}>
          <h2 id="problem-title" className={styles.problemStatement}>{copy.problemTitle}</h2>
          <ol className={styles.problemList}>{problems.map((problem, index) => <li key={problem} className={styles.problemRow}><span className={styles.problemNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.problemText}>{problem}</span></li>)}</ol>
        </div>
      </section>

      <section id="prepare" className={`${styles.section} bg-[var(--sheet)]`} aria-labelledby="prepare-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>02 / Prepare</p><h2 id="prepare-title" className={styles.sectionTitle}>{copy.prepareTitle}</h2></div><p className={styles.sectionLede}>Move from the reviewed scheme to a frozen application version. Each field, document, and check keeps its reason and source close by.</p></div>
          <div className="pb-20 lg:pb-28"><JourneyExplorer /></div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="reported-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>How every check is reported</p><h2 id="reported-title" className={styles.sectionTitle}>A result is only useful when it tells you what to do.</h2></div><p className={styles.sectionLede}>Every backend state has a distinct mark, a plain-language label, and an example. Colour reinforces meaning but never carries it alone.</p></div>
          <div className={styles.checkReportGrid}>
            <div className={styles.statusTable}>{statuses.map(([tone, symbol, label, example, code]) => <div key={code} tabIndex={0} className={styles.statusRow}><span className={`${styles.statusMark} ${styles[`status${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles]}`}>{symbol}</span><strong>{label}</strong><span className={styles.statusExample}>{example}</span><span className="font-mono text-[0.68rem] text-[var(--neutral)] sm:text-right">{code}</span></div>)}</div>
            <div><p className={styles.kicker}>Anatomy of a failed check</p><h3 className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-[-0.03em]">Income values do not agree</h3><dl className={`${styles.failedAnatomy} mt-7`}><div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On your form</dt><dd className="font-mono">₹4,20,000</dd></div><div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>On your document</dt><dd className="font-mono">₹4,80,000</dd></div><div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>Why they do not match</dt><dd>The entered amount differs from the family income certificate.</dd></div><div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>What to do next</dt><dd>Correct the form or add the certificate that supports the application answer.</dd></div><div className={styles.anatomyRow}><dt className={styles.anatomyTerm}>Source</dt><dd>PM-USP CSSS Guidelines · policy version <span className="font-mono text-xs">2026–27.3</span></dd></div></dl></div>
          </div>
        </div>
      </section>

      <section id="diagnose" className={`${styles.section} bg-[var(--sheet)]`} aria-labelledby="diagnose-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>03 / Diagnose</p><h2 id="diagnose-title" className={styles.sectionTitle}>{copy.diagnoseTitle}</h2></div><p className={styles.sectionLede}>Keep the authority’s reason separate from SevaFix inference, inspect the cited rule, and compare the preserved version with its repair draft.</p></div>
          <div className="pb-20 lg:pb-28"><DiagnosisExplorer /></div>
        </div>
      </section>

      <section id="how-it-decides" className={styles.section} aria-labelledby="decides-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>How it decides</p><h2 id="decides-title" className={styles.sectionTitle}>{copy.decisionTitle}</h2></div><p className={styles.sectionLede}>Follow the full evidence route or inspect the deployed services. If retrieval or AI is unavailable, the path ends in a deterministic result.</p></div>
          <EvidencePipelineDiagram />
          <div className={`${styles.decisionGrid} py-20 lg:py-28`}>
            <div><p className={styles.kicker}>Who has the final word</p><h3 className="mt-4 max-w-[12ch] font-[family-name:var(--font-display)] text-4xl leading-none tracking-[-0.035em]">Authority first. Explanation last.</h3><p className="mt-6 max-w-lg leading-7 text-[var(--ink-2)]">A passed SevaFix check means the implemented rule found no problem in the supplied evidence. It never guarantees acceptance, selection, or payment.</p></div>
            <ol className={styles.rankedList}><li className={styles.rankedRow}><span><strong className="block">Official authority</strong><small className="text-[var(--ink-2)]">Receives, reviews, and decides</small></span></li><li className={styles.rankedRow}><span><strong className="block">Reviewed policy versions</strong><small className="text-[var(--ink-2)]">Define the dated source of truth</small></span></li><li className={styles.rankedRow}><span><strong className="block">Deterministic checks</strong><small className="text-[var(--ink-2)]">Compare structured facts with rules and evidence</small></span></li><li className={styles.rankedRow}><span><strong className="block">AI explanation</strong><small className="text-[var(--ink-2)]">Uses supplied, redacted evidence only and yields to check facts</small></span></li></ol>
          </div>
        </div>
      </section>

      <section id="privacy" className={`${styles.section} bg-[var(--sheet)]`} aria-labelledby="privacy-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>Privacy and security</p><h2 id="privacy-title" className={styles.sectionTitle}>Collect less. Keep access short. State the gaps.</h2></div><p className={styles.sectionLede}>SevaFix handles application evidence as private working material. It does not reuse documents for model training or place personal data in URLs, analytics, or browser storage.</p></div>
          <dl className={`${styles.definitionGrid} pb-20 lg:pb-28`}>{privacyItems.map(([term, detail]) => <div key={term} className={styles.definitionItem}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl>
        </div>
      </section>

      <section id="schemes" className={styles.section} aria-labelledby="schemes-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>Schemes</p><h2 id="schemes-title" className={styles.sectionTitle}>Ten schemes, supported with reviewed checks.</h2></div><p className={styles.sectionLede}>Prepare or diagnose an application using the active SevaFix catalog, versioned policy checks, scheme-specific forms, and required-evidence lists.</p></div>
          <div className="pb-20 lg:pb-28"><LandingSchemes /><p className="mt-5 text-sm text-[var(--ink-2)]">Sign in to open a scheme and view its complete application workflow.</p></div>
        </div>
      </section>

      <section className={`${styles.section} bg-[var(--sheet)]`} aria-labelledby="questions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><p className={styles.kicker}>Questions</p><h2 id="questions-title" className={styles.sectionTitle}>Where SevaFix stops.</h2></div></div>
          <div className={`${styles.questions} pb-20 lg:pb-28`}><details className={styles.question}><summary>Do you submit the application for me?</summary><p>No. You review and submit through the official government portal. SevaFix can preserve the version you prepared and record the reference afterward.</p></details><details className={styles.question}><summary>Can you guarantee approval?</summary><p>No. SevaFix reports preparation checks against reviewed rules and your evidence. The responsible authority decides eligibility, selection, acceptance, and payment.</p></details><details className={styles.question}><summary>Is the AI deciding?</summary><p>No. Deterministic checks produce the result. AI may explain failed checks using supplied, redacted evidence and validated citations. If that path is unavailable, the rules-only result remains.</p></details><details className={styles.question}><summary>What happens to my documents?</summary><p>They are uploaded to private storage and accessed through short-lived signed links. You can remove editable documents or request account deletion. The development environment does not currently have malware scanning enabled.</p></details></div>
        </div>
      </section>

      <section className={styles.closing} aria-label="Choose a journey">
        <div className={`${styles.container} ${styles.closingGrid}`}><div className={styles.closingJourney}><p className="font-mono text-xs uppercase tracking-[0.12em] text-white/60">Preparing to apply</p><h2 className="mt-4 max-w-md font-[family-name:var(--font-display)] text-4xl leading-none">Catch preventable problems before submission.</h2><Link href="/signup?intent=prepare" className={styles.closingLink}>Prepare an application →</Link></div><div className={styles.closingJourney}><p className="font-mono text-xs uppercase tracking-[0.12em] text-white/60">Already rejected or returned</p><h2 className="mt-4 max-w-md font-[family-name:var(--font-display)] text-4xl leading-none">Understand what failed and prepare a focused correction.</h2><Link href="/signup?intent=diagnose" className={styles.closingLink}>Diagnose a rejection →</Link></div></div>
        <footer className={`${styles.container} ${styles.footer}`}><p>SevaFix is an independent application workspace. It is not affiliated with or operated by the Government of India. SevaFix does not submit applications, make government decisions, or guarantee eligibility or approval. You submit through the official portal, and the responsible authority has the final word.</p></footer>
      </section>
    </div>
  );
}
