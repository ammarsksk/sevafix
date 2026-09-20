"use client";

import { useMemo, useState } from "react";

import styles from "./lab.module.css";

type NodeDetail = {
  id: string;
  label: string;
  x: number;
  y: number;
  input: string;
  output: string;
  forbidden: string;
  pending?: boolean;
};

const diagnosisNodes: NodeDetail[] = [
  { id: "rejection", label: "Rejection message", x: 85, y: 60, input: "Reason text or a processed rejection notice.", output: "A preserved, untrusted statement of the problem.", forbidden: "Cannot be treated as a policy rule or instruction to the system." },
  { id: "application", label: "Application", x: 85, y: 155, input: "The frozen application version.", output: "Structured form facts with their original version.", forbidden: "Cannot be silently edited during diagnosis." },
  { id: "documents", label: "Documents", x: 85, y: 250, input: "Confirmed facts from the applicant’s evidence.", output: "Values with provenance and confidence.", forbidden: "Low-confidence OCR cannot be treated as confirmed fact." },
  { id: "checks", label: "Deterministic checks", x: 285, y: 155, input: "Application facts, document facts, and versioned rules.", output: "Passed, failed, review, or blocked results.", forbidden: "Cannot claim approval or selection." },
  { id: "policy", label: "Reviewed policy retrieval", x: 485, y: 85, input: "Failed rule IDs and the pinned policy version.", output: "Reviewed passages from approved official sources.", forbidden: "Cannot retrieve unreviewed or unrelated sources." },
  { id: "redaction", label: "Personal-data redaction", x: 485, y: 225, input: "Only the facts needed to explain the result.", output: "A minimized, redacted evidence packet.", forbidden: "Raw documents and direct identifiers cannot pass through." },
  { id: "ai", label: "Constrained AI explanation", x: 690, y: 155, input: "Failed checks and reviewed, redacted evidence.", output: "Plain-language explanation with citation IDs.", forbidden: "AI may only use the supplied evidence and failed checks." },
  { id: "citations", label: "Citation validation", x: 865, y: 85, input: "Explanation claims and citation identifiers.", output: "Only claims with resolvable reviewed sources.", forbidden: "Unresolved or mismatched citations cannot be shown." },
  { id: "diagnosis", label: "Diagnosis", x: 865, y: 235, input: "Validated explanation or deterministic fallback.", output: "Likely issue, evidence, correction, and limitations.", forbidden: "Cannot override the official authority." },
];

const infrastructureNodes: NodeDetail[] = [
  { id: "cognito", label: "Cognito", x: 70, y: 75, input: "Email sign-in and group claims.", output: "Short-lived user tokens.", forbidden: "Cannot grant document access without ownership checks." },
  { id: "gateway", label: "API Gateway", x: 235, y: 75, input: "Authenticated browser requests.", output: "Authorized API traffic.", forbidden: "Cannot expose citizen routes without an ID token." },
  { id: "lambda", label: "Lambda", x: 405, y: 75, input: "Validated API commands.", output: "Domain operations and workflow starts.", forbidden: "Cannot log form or document content." },
  { id: "dynamo", label: "DynamoDB", x: 575, y: 75, input: "Versioned application and policy records.", output: "Immutable history and current pointers.", forbidden: "Cannot store document binaries." },
  { id: "s3", label: "S3", x: 405, y: 220, input: "Direct private uploads and official snapshots.", output: "Encrypted versioned objects.", forbidden: "Cannot expose a permanent public document URL." },
  { id: "steps", label: "Step Functions", x: 575, y: 220, input: "Asynchronous validation, OCR, diagnosis, and deletion jobs.", output: "Recoverable workflow state.", forbidden: "Cannot skip terminal failure handling." },
  { id: "textract", label: "Textract", x: 750, y: 220, input: "Supported English or Latin-text documents.", output: "Text and field confidence.", forbidden: "Cannot read unsupported Indic scripts as authoritative OCR." },
  { id: "bedrock", label: "Bedrock", x: 750, y: 75, input: "Redacted facts and reviewed evidence.", output: "Constrained cited explanation.", forbidden: "Cannot decide eligibility or alter an application." },
  { id: "kb", label: "Knowledge Base", x: 905, y: 145, input: "Published, verified policy artifacts and metadata from the managed data source.", output: "Live semantic and keyword retrieval across the reviewed scheme-policy corpus.", forbidden: "Cannot retrieve unreviewed evidence or replace version-pinned deterministic checks." },
];

const diagnosisPaths = ["M85 60 H185 V155 H285", "M85 155 H285", "M85 250 H185 V155 H285", "M285 155 H385 V85 H485", "M285 155 H385 V225 H485", "M485 85 H590 V155 H690", "M485 225 H590 V155 H690", "M690 155 H775 V85 H865", "M865 85 V235", "M690 155 H775 V235 H865"];
const infrastructurePaths = ["M70 75 H235", "M235 75 H405", "M405 75 H575", "M405 75 V220", "M405 220 H575", "M575 220 H750", "M575 220 V75 H750", "M750 75 H830 V145 H905", "M750 220 H830 V145 H905"];

function keyActivate(event: React.KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
}

export function EvidencePipelineDiagram() {
  const [mode, setMode] = useState<"diagnosis" | "infrastructure">("diagnosis");
  const [fallback, setFallback] = useState(false);
  const nodes = mode === "diagnosis" ? diagnosisNodes : infrastructureNodes;
  const paths = mode === "diagnosis" ? diagnosisPaths : infrastructurePaths;
  const [selectedId, setSelectedId] = useState("checks");
  const selected = useMemo(() => nodes.find((node) => node.id === selectedId) ?? nodes[0], [nodes, selectedId]);

  const changeMode = (next: "diagnosis" | "infrastructure") => {
    setMode(next);
    setSelectedId(next === "diagnosis" ? "checks" : "cognito");
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.diagramControls}>
        <div className={styles.segments} aria-label="Diagram mode">
          <button type="button" className={`${styles.segmentButton} ${mode === "diagnosis" ? styles.segmentActive : ""}`} aria-pressed={mode === "diagnosis"} onClick={() => changeMode("diagnosis")}>How a diagnosis is built</button>
          <button type="button" className={`${styles.segmentButton} ${mode === "infrastructure" ? styles.segmentActive : ""}`} aria-pressed={mode === "infrastructure"} onClick={() => changeMode("infrastructure")}>Infrastructure</button>
        </div>
        {mode === "diagnosis" ? <label className={styles.toggleLabel}><input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} /> AI or retrieval unavailable</label> : <p className={styles.meta}>AP-SOUTH-1 · SOLID LIVE · DASHED PENDING</p>}
      </div>

      <div className={styles.diagramGrid}>
        <div className={styles.diagramCanvas}>
          <svg className={styles.desktopDiagram} viewBox="0 0 960 320" role="img" aria-labelledby="pipeline-title pipeline-description">
            <title id="pipeline-title">{mode === "diagnosis" ? "Evidence pipeline for a SevaFix diagnosis" : "Deployed SevaFix infrastructure"}</title>
            <desc id="pipeline-description">Select any labelled node to read what it receives, produces, and is forbidden to do.</desc>
            {paths.map((path, index) => <path key={path} d={path} className={`${styles.diagramLine} ${fallback && mode === "diagnosis" && index > 6 ? styles.diagramFallback : ""}`} />)}
            {fallback && mode === "diagnosis" ? <><path d="M285 155 H610 V285 H865 V235" className={`${styles.diagramLine} ${styles.diagramFallback}`} /><text x="610" y="302" className={styles.diagramText}>deterministic result</text></> : null}
            {!fallback && mode === "diagnosis" ? <><circle r="4" className={styles.pulse}><animateMotion dur="3.2s" repeatCount="indefinite" path="M85 155 H285 H385 V85 H485 H590 V155 H690 H775 V85 H865 V235" /></circle><circle r="4" className={styles.pulse}><animateMotion dur="3.2s" begin="-1.6s" repeatCount="indefinite" path="M85 250 H185 V155 H285 H385 V225 H485 H590 V155 H690 H775 V235 H865" /></circle></> : null}
            {nodes.map((node) => (
              <g key={node.id} role="button" tabIndex={0} aria-label={`Inspect ${node.label}`} onClick={() => setSelectedId(node.id)} onKeyDown={(event) => keyActivate(event, () => setSelectedId(node.id))} className={`${styles.diagramNode} ${selected.id === node.id ? styles.diagramNodeActive : ""} ${node.pending ? styles.diagramNodePending : ""}`}>
                <circle cx={node.x} cy={node.y} r="8" />
                <text x={node.x} y={node.y + 24} textAnchor="middle" className={styles.diagramText}>{node.label}</text>
              </g>
            ))}
          </svg>

          <div className={styles.mobileFlow}>
            {nodes.map((node, index) => <button type="button" key={node.id} className={styles.flowStep} onClick={() => setSelectedId(node.id)} aria-current={selected.id === node.id ? "step" : undefined}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span className="font-semibold">{node.label}</span></button>)}
          </div>
          {fallback && mode === "diagnosis" ? <p className="mt-4 border-l-2 border-dashed border-[var(--review)] pl-4 text-sm leading-6 text-[var(--ink-2)]">Fallback active: the evidence path ends in a deterministic result. No AI explanation is shown.</p> : null}
        </div>

        <aside className={styles.diagramSide} aria-live="polite">
          <p className={styles.kicker}>Selected step</p>
          <h3 className="mt-3 text-lg font-semibold">{selected.label}</h3>
          <dl className="mt-6 border-t border-[var(--rule)] text-sm">
            <div className="border-b border-[var(--rule)] py-4"><dt className={styles.anatomyTerm}>What goes in</dt><dd className="mt-2 leading-6">{selected.input}</dd></div>
            <div className="border-b border-[var(--rule)] py-4"><dt className={styles.anatomyTerm}>What comes out</dt><dd className="mt-2 leading-6">{selected.output}</dd></div>
            <div className="py-4"><dt className={styles.anatomyTerm}>Forbidden</dt><dd className="mt-2 leading-6">{selected.forbidden}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
