"use client";

import { useState } from "react";

import styles from "@/components/reviewer-console.module.css";
import { Button, ConfirmModal, ErrorBanner, TextField } from "@/components/ui";
import { usePublishPolicy, useRollbackPolicy } from "@/lib/sevafix/queries";

const RULE_OPS = ["PRESENT", "EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NOT_IN", "DATE_BETWEEN", "NAME_SIMILAR"];

interface RuleDraft { ruleId: string; title: string; severity: "BLOCKING" | "ADVISORY"; field: string; op: string; value: string; requiredEvidence: string; sourceRefs: string; }
const emptyRule = (): RuleDraft => ({ ruleId: "", title: "", severity: "BLOCKING", field: "", op: "EQ", value: "", requiredEvidence: "", sourceRefs: "" });
const toCsvList = (raw: string) => raw.split(",").map((item) => item.trim()).filter(Boolean);
const parseValue = (raw: string): unknown => { const trimmed = raw.trim(); if (trimmed === "") return ""; try { return JSON.parse(trimmed); } catch { return trimmed; } };

function PublishPolicyForm() {
  const publish = usePublishPolicy();
  const [schemeId, setSchemeId] = useState("pm-usp-csss");
  const [policyText, setPolicyText] = useState("");
  const [authority, setAuthority] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveDateConfidence, setEffectiveDateConfidence] = useState<"CONFIRMED" | "ESTIMATED">("CONFIRMED");
  const [sourceIds, setSourceIds] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [versionId, setVersionId] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule()]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const updateRule = (index: number, patch: Partial<RuleDraft>) => setRules((previous) => previous.map((rule, current) => current === index ? { ...rule, ...patch } : rule));
  const buildPayload = (): Record<string, unknown> => ({ schemeId: schemeId.trim(), policyText, rules: rules.map((rule) => ({ ruleId: rule.ruleId.trim(), title: rule.title.trim(), severity: rule.severity, requiredEvidence: toCsvList(rule.requiredEvidence), assert: { field: rule.field.trim(), op: rule.op, value: parseValue(rule.value) }, sourceRefs: toCsvList(rule.sourceRefs) })), sourceIds: toCsvList(sourceIds), authority: authority.trim(), effectiveFrom, effectiveDateConfidence, auditReason: auditReason.trim(), confirmation: "PUBLISH" });

  function reviewPublish() {
    setError(null); setResult(null);
    if (!versionId.trim() || !schemeId.trim() || !policyText.trim() || !auditReason.trim()) return setError("Version ID, scheme ID, policy text, and audit reason are required.");
    if (rules.some((rule) => !rule.ruleId.trim() || !rule.field.trim())) return setError("Every rule needs a rule ID and assertion field.");
    if (new Set(rules.map((rule) => rule.ruleId.trim())).size !== rules.length) return setError("Rule IDs must be unique.");
    setConfirming(true);
  }

  async function onPublish() {
    setError(null); setResult(null);
    try { const response = await publish.mutateAsync({ versionId: versionId.trim(), body: buildPayload() }); setResult(`Published ${versionId.trim()} with ${response.ruleCount} rule(s).`); setConfirming(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not publish policy"); }
  }

  return <section className={styles.section} id="publish"><h2 className={styles.sectionTitle}>Publish an immutable policy version</h2><p className={styles.sectionNote}>The version ID cannot be reused. Publication changes the scheme&apos;s active policy pointer.</p><ErrorBanner message={error} />{result ? <p className={styles.success}>{result}</p> : null}
    <div className={styles.formGrid}><TextField label="Policy version ID" value={versionId} onChange={(event) => setVersionId(event.target.value)} /><TextField label="Scheme ID" value={schemeId} onChange={(event) => setSchemeId(event.target.value)} /><TextField label="Authority" value={authority} onChange={(event) => setAuthority(event.target.value)} /><TextField label="Effective from" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /><label className="block"><span className="mb-1 block text-sm font-medium">Effective date confidence</span><select className="w-full px-3 py-2 text-sm" value={effectiveDateConfidence} onChange={(event) => setEffectiveDateConfidence(event.target.value as "CONFIRMED" | "ESTIMATED")}><option value="CONFIRMED">Confirmed</option><option value="ESTIMATED">Estimated</option></select></label><TextField label="Source IDs, comma separated" value={sourceIds} onChange={(event) => setSourceIds(event.target.value)} /></div>
    <label className="mt-4 block"><span className="mb-1 block text-sm font-medium">Reviewed policy text</span><textarea className="w-full px-3 py-2 font-mono text-sm" rows={9} value={policyText} onChange={(event) => setPolicyText(event.target.value)} /></label>
    <div className="mt-8 flex items-end justify-between gap-4 border-b border-[var(--rule-strong)] pb-3"><div><h3 className={styles.sectionTitle}>Rule register</h3><p className={styles.sectionNote}>Between 1 and 20 deterministic rules.</p></div><Button variant="secondary" onClick={() => setRules((previous) => [...previous, emptyRule()])} disabled={rules.length >= 20}>Add rule</Button></div>
    <div>{rules.map((rule, index) => <div key={index} className={styles.ruleRow}><div className={styles.ruleHeader}><span>RULE {String(index + 1).padStart(2, "0")}</span>{rules.length > 1 ? <Button variant="ghost" onClick={() => setRules((previous) => previous.filter((_, current) => current !== index))}>Remove</Button> : null}</div><div className={styles.formRow}><TextField label="Rule ID" value={rule.ruleId} onChange={(event) => updateRule(index, { ruleId: event.target.value })} /><TextField label="Title" value={rule.title} onChange={(event) => updateRule(index, { title: event.target.value })} /><label className="block"><span className="mb-1 block text-sm font-medium">Severity</span><select className="w-full px-3 py-2 text-sm" value={rule.severity} onChange={(event) => updateRule(index, { severity: event.target.value as RuleDraft["severity"] })}><option value="BLOCKING">Blocking</option><option value="ADVISORY">Advisory</option></select></label><TextField label="Required evidence, comma separated" value={rule.requiredEvidence} onChange={(event) => updateRule(index, { requiredEvidence: event.target.value })} /><TextField label="Assertion field" value={rule.field} onChange={(event) => updateRule(index, { field: event.target.value })} /><label className="block"><span className="mb-1 block text-sm font-medium">Assertion operation</span><select className="w-full px-3 py-2 text-sm" value={rule.op} onChange={(event) => updateRule(index, { op: event.target.value })}>{RULE_OPS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label><TextField label="Assertion value" hint="Numbers, booleans, and arrays are parsed as JSON." value={rule.value} onChange={(event) => updateRule(index, { value: event.target.value })} /><TextField label="Source references, comma separated" value={rule.sourceRefs} onChange={(event) => updateRule(index, { sourceRefs: event.target.value })} /></div></div>)}</div>
    <div className="mt-6"><TextField label="Audit reason" value={auditReason} onChange={(event) => setAuditReason(event.target.value)} /><Button className="mt-4" onClick={reviewPublish}>Review publication</Button></div>
    {confirming ? <ConfirmModal title={`Publish ${versionId.trim()}?`} description={<div><p>This will publish <span className="font-mono">{versionId.trim()}</span> for <span className="font-mono">{schemeId.trim()}</span> with {rules.length} rule(s).</p><p className="mt-2">Audit reason: {auditReason.trim()}</p></div>} confirmLabel="Publish version" requireText="PUBLISH" onConfirm={onPublish} onClose={() => setConfirming(false)} busy={publish.isPending} /> : null}
  </section>;
}
function RollbackPolicyForm() {
  const rollback = useRollbackPolicy();
  const [versionId, setVersionId] = useState("");
  const [schemeId, setSchemeId] = useState("pm-usp-csss");
  const [auditReason, setAuditReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function reviewRollback() {
    setError(null); setResult(null);
    if (!versionId.trim() || !schemeId.trim() || !auditReason.trim()) return setError("Version ID, scheme ID, and audit reason are required.");
    setConfirming(true);
  }
  async function onRollback() {
    setError(null); setResult(null);
    try { const response = await rollback.mutateAsync({ versionId: versionId.trim(), schemeId: schemeId.trim(), auditReason: auditReason.trim() }); setResult(`Active policy pointer now targets ${response.activePolicyVersionId}.`); setConfirming(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not roll back policy pointer"); }
  }

  return <section className={styles.section} id="rollback"><h2 className={styles.sectionTitle}>Roll back the active policy pointer</h2><p className={styles.sectionNote}>The target must already be a published version. Existing application versions remain pinned to their original policy.</p><ErrorBanner message={error} />{result ? <p className={styles.success}>{result}</p> : null}<div className={styles.formGrid}><TextField label="Published version ID" value={versionId} onChange={(event) => setVersionId(event.target.value)} /><TextField label="Scheme ID" value={schemeId} onChange={(event) => setSchemeId(event.target.value)} /></div><div className="mt-4"><TextField label="Audit reason" value={auditReason} onChange={(event) => setAuditReason(event.target.value)} /></div><Button variant="danger" className="mt-4" onClick={reviewRollback}>Review rollback</Button>{confirming ? <ConfirmModal title={`Roll back to ${versionId.trim()}?`} description={<div><p>This changes the active pointer for <span className="font-mono">{schemeId.trim()}</span> to exact version <span className="font-mono">{versionId.trim()}</span>.</p><p className="mt-2">Audit reason: {auditReason.trim()}</p></div>} confirmLabel="Roll back pointer" requireText="ROLLBACK" danger onConfirm={onRollback} onClose={() => setConfirming(false)} busy={rollback.isPending} /> : null}</section>;
}

export default function PoliciesPage() {
  return <div><header className={styles.masthead}><div><p className={styles.kicker}>02 / Policy versions</p><h1 className={styles.title}>Publish and roll back policy</h1><p className={styles.description}>Create immutable reviewed versions or move a scheme&apos;s active pointer to an existing published version.</p></div><p className={styles.meta}>NO SILENT RETRIES</p></header><nav className={styles.toolbar} aria-label="Policy actions"><a href="#publish" className={styles.link}>Publish version</a><a href="#rollback" className={styles.link}>Rollback pointer</a></nav><PublishPolicyForm /><RollbackPolicyForm /></div>;
}

