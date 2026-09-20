import Link from "next/link";

import { DiagnosisExplorer } from "@/components/lab/diagnosis-explorer";
import { EvidencePipelineDiagram } from "@/components/lab/evidence-pipeline-diagram";
import { JourneyExplorer } from "@/components/lab/journey-explorer";
import { LiveCheckSimulator } from "@/components/lab/live-check-simulator";
import styles from "@/components/lab/lab.module.css";

export const metadata = {
  title: "Interaction lab",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  return (
    <div className="bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule-strong)]">
        <div className="mx-auto max-w-[1360px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <p className={styles.kicker}>Checkpoint 02 / Interaction lab</p>
          <div className="mt-7 grid gap-8 lg:grid-cols-[0.72fr_0.28fr] lg:items-end">
            <div><h1 className="max-w-[14ch] font-[family-name:var(--font-display)] text-5xl font-medium leading-[0.96] tracking-[-0.045em] sm:text-7xl">Four ways to see what SevaFix is doing.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">Each prototype is isolated here before it enters the landing page. The examples use a fictional applicant and reviewed PM-USP policy version 2026–27.3.</p></div>
            <nav className="border-l border-[var(--rule)] pl-5 text-sm" aria-label="Lab contents"><ol className="space-y-3"><li><a className="font-semibold text-[var(--accent)] underline" href="#live-check">01 · Live check</a></li><li><a className="font-semibold text-[var(--accent)] underline" href="#prepare-journey">02 · Prepare journey</a></li><li><a className="font-semibold text-[var(--accent)] underline" href="#diagnosis">03 · Diagnosis</a></li><li><a className="font-semibold text-[var(--accent)] underline" href="#pipeline">04 · Evidence pipeline</a></li></ol></nav>
          </div>
        </div>
      </header>

      <main>
        <section id="live-check" className={styles.piece}>
          <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
            <div className={styles.pieceHeader}><div><p className={styles.kicker}>01 / Live check simulator</p><h2 className={styles.title}>Compare the answer with the evidence.</h2></div><p className={styles.lede}>Edit the sample form or remove the identity evidence. The results are deterministic and rerun immediately in the browser.</p></div>
            <LiveCheckSimulator />
          </div>
        </section>

        <section id="prepare-journey" className={`${styles.piece} bg-[var(--sheet)]`}>
          <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
            <div className={styles.pieceHeader}><div><p className={styles.kicker}>02 / Prepare explorer</p><h2 className={styles.title}>The application, one accountable step at a time.</h2></div><p className={styles.lede}>Scroll the work area or choose a step directly. The margin carries explanations and evidence without interrupting the form.</p></div>
            <JourneyExplorer />
          </div>
        </section>

        <section id="diagnosis" className={styles.piece}>
          <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
            <div className={styles.pieceHeader}><div><p className={styles.kicker}>03 / Diagnosis explorer</p><h2 className={styles.title}>The explanation stays tied to the failed check.</h2></div><p className={styles.lede}>Change what the authority supplied, remove AI from the path, focus citation [1], or compare the preserved original with its repair draft.</p></div>
            <DiagnosisExplorer />
          </div>
        </section>

        <section id="pipeline" className={`${styles.piece} bg-[var(--sheet)]`}>
          <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
            <div className={styles.pieceHeader}><div><p className={styles.kicker}>04 / Evidence pipeline</p><h2 className={styles.title}>Trace the route from evidence to diagnosis.</h2></div><p className={styles.lede}>Switch between product logic and deployed infrastructure. Every step says what it may receive, produce, and never do.</p></div>
            <EvidencePipelineDiagram />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)]"><div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-5 py-8 text-sm sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12"><p>Interaction checkpoint complete. These samples do not submit or decide an application.</p><Link href="/specimen" className="font-semibold underline decoration-white/40 hover:decoration-white">Return to the foundation specimen</Link></div></footer>
    </div>
  );
}
