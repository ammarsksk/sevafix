"use client";

import { useState } from "react";

import { ReviewerRoute } from "@/components/route-guards";
import { Button, Card, ConfirmModal, ErrorBanner, PageHeader, TextField } from "@/components/ui";
import { usePublishPolicy, useRollbackPolicy } from "@/lib/sevafix/queries";

const RULE_OPS = ["PRESENT", "EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NOT_IN", "DATE_BETWEEN", "NAME_SIMILAR"];

interface RuleDraft {
  ruleId: string;
  title: string;
  severity: "BLOCKING" | "ADVISORY";
  field: string;
  op: string;
  value: string;
  requiredEvidence: string;
  sourceRefs: string;
}

function emptyRule(): RuleDraft {
  return {
    ruleId: "",
    title: "",
    severity: "BLOCKING",
    field: "",
    op: "EQ",
    value: "",
    requiredEvidence: "",
    sourceRefs: "",
  };
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function toCsvList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function PublishPolicyForm() {
  const publish = usePublishPolicy();
  const [schemeId, setSchemeId] = useState("pm-usp-csss");
  const [policyText, setPolicyText] = useState("");
  const [authority, setAuthority] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveDateConfidence, setEffectiveDateConfidence] = useState<"CONFIRMED" | "ESTIMATED">(
    "CONFIRMED",
  );
  const [sourceIds, setSourceIds] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [versionId, setVersionId] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule()]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function updateRule(index: number, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function buildPayload(): Record<string, unknown> {
    return {
      schemeId,
      policyText,
      rules: rules.map((rule) => ({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        requiredEvidence: toCsvList(rule.requiredEvidence),
        assert: { field: rule.field, op: rule.op, value: parseValue(rule.value) },
        sourceRefs: toCsvList(rule.sourceRefs),
      })),
      sourceIds: toCsvList(sourceIds),
      authority,
      effectiveFrom,
      effectiveDateConfidence,
      auditReason,
      confirmation: "PUBLISH",
    };
  }

  async function onPublish() {
    setError(null);
    setResult(null);
    if (!versionId) {
      setError("Enter the policy version ID to publish.");
      return;
    }
    try {
      const response = await publish.mutateAsync({ versionId, body: buildPayload() });
      setResult(`Published with ${response.ruleCount} rule(s).`);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish policy");
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Publish policy version</h2>
      <ErrorBanner message={error} />
      {result ? <p className="mb-3 text-sm text-emerald-700">{result}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Policy version ID" value={versionId} onChange={(e) => setVersionId(e.target.value)} />
        <TextField label="Scheme ID" value={schemeId} onChange={(e) => setSchemeId(e.target.value)} />
        <TextField label="Authority" value={authority} onChange={(e) => setAuthority(e.target.value)} />
        <TextField
          label="Effective from"
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Effective date confidence</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={effectiveDateConfidence}
            onChange={(e) => setEffectiveDateConfidence(e.target.value as "CONFIRMED" | "ESTIMATED")}
          >
            <option value="CONFIRMED">Confirmed</option>
            <option value="ESTIMATED">Estimated</option>
          </select>
        </label>
        <TextField
          label="Source IDs (comma separated)"
          value={sourceIds}
          onChange={(e) => setSourceIds(e.target.value)}
        />
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-800">Policy text</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={4}
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
        />
      </label>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Rules (1–20)</h3>
          <Button
            variant="secondary"
            onClick={() => setRules((prev) => [...prev, emptyRule()])}
            disabled={rules.length >= 20}
          >
            Add rule
          </Button>
        </div>
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="rounded-md border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Rule ID"
                  value={rule.ruleId}
                  onChange={(e) => updateRule(index, { ruleId: e.target.value })}
                />
                <TextField
                  label="Title"
                  value={rule.title}
                  onChange={(e) => updateRule(index, { title: e.target.value })}
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-800">Severity</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={rule.severity}
                    onChange={(e) => updateRule(index, { severity: e.target.value as RuleDraft["severity"] })}
                  >
                    <option value="BLOCKING">Blocking</option>
                    <option value="ADVISORY">Advisory</option>
                  </select>
                </label>
                <TextField
                  label="Required evidence (comma separated)"
                  value={rule.requiredEvidence}
                  onChange={(e) => updateRule(index, { requiredEvidence: e.target.value })}
                />
                <TextField
                  label="Assert field"
                  value={rule.field}
                  onChange={(e) => updateRule(index, { field: e.target.value })}
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-800">Assert operation</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={rule.op}
                    onChange={(e) => updateRule(index, { op: e.target.value })}
                  >
                    {RULE_OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Assert value"
                  hint="Numbers/booleans/arrays are parsed as JSON automatically."
                  value={rule.value}
                  onChange={(e) => updateRule(index, { value: e.target.value })}
                />
                <TextField
                  label="Source refs (comma separated)"
                  value={rule.sourceRefs}
                  onChange={(e) => updateRule(index, { sourceRefs: e.target.value })}
                />
              </div>
              {rules.length > 1 ? (
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove rule
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <TextField
        className="mt-4"
        label="Audit reason"
        value={auditReason}
        onChange={(e) => setAuditReason(e.target.value)}
      />

      <Button className="mt-4" onClick={() => setConfirming(true)}>
        Review and publish
      </Button>

      {confirming ? (
        <ConfirmModal
          title="Publish policy version?"
          description={`This publishes ${rules.length} rule(s) for ${schemeId} as version ${versionId}. This is a consequential, auditable action.`}
          confirmLabel="Publish"
          requireText="PUBLISH"
          onConfirm={onPublish}
          onClose={() => setConfirming(false)}
          busy={publish.isPending}
        />
      ) : null}
    </Card>
  );
}

function RollbackPolicyForm() {
  const rollback = useRollbackPolicy();
  const [versionId, setVersionId] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onRollback() {
    setError(null);
    setResult(null);
    try {
      const response = await rollback.mutateAsync({ versionId, schemeId, auditReason });
      setResult(`Active policy version is now ${response.activePolicyVersionId}.`);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not roll back policy");
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Roll back active policy pointer</h2>
      <ErrorBanner message={error} />
      {result ? <p className="mb-3 text-sm text-emerald-700">{result}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Version ID to roll back to" value={versionId} onChange={(e) => setVersionId(e.target.value)} />
        <TextField label="Scheme ID" value={schemeId} onChange={(e) => setSchemeId(e.target.value)} />
      </div>
      <TextField
        className="mt-4"
        label="Audit reason"
        value={auditReason}
        onChange={(e) => setAuditReason(e.target.value)}
      />
      <Button variant="danger" className="mt-4" onClick={() => setConfirming(true)}>
        Roll back pointer
      </Button>

      {confirming ? (
        <ConfirmModal
          title="Roll back the active policy pointer?"
          description={`This changes the active policy version for ${schemeId} to ${versionId}. This is a consequential, auditable action.`}
          confirmLabel="Roll back"
          requireText="ROLLBACK"
          danger
          onConfirm={onRollback}
          onClose={() => setConfirming(false)}
          busy={rollback.isPending}
        />
      ) : null}
    </Card>
  );
}

function PoliciesContent() {
  return (
    <div>
      <PageHeader
        title="Policies"
        description="Publish reviewed policy versions or roll back a scheme's active pointer."
      />
      <div className="space-y-6">
        <PublishPolicyForm />
        <RollbackPolicyForm />
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <ReviewerRoute>
      <PoliciesContent />
    </ReviewerRoute>
  );
}
