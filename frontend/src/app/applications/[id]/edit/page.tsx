"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, ErrorBanner, FullPageSpinner, PageHeader, TextField } from "@/components/ui";
import { isFieldVisible, schemeFields, schemeSections, type UiField } from "@/lib/sevafix/scheme-schema";
import { useApplication, useSaveDraft, useScheme } from "@/lib/sevafix/queries";
import { SevaFixApiError } from "@/lib/sevafix/sevafix-api";
import type { DraftFields } from "@/lib/sevafix/sevafix-types";

const AUTOSAVE_DELAY_MS = 1200;

const whyWeAsk: Record<string, string> = {
  "student.primaryName": "Compared with the name on uploaded identity and academic evidence.",
  "student.familyAnnualIncomeINR": "Compared with the family income certificate and the rule pinned to this draft.",
  "student.boardPercentile": "Used only when the reviewed fresh-application rule and supporting marks evidence apply.",
  "student.receivesOtherScholarship": "The reviewed policy excludes some overlapping scholarships or fee reimbursements.",
  "institution.aisheCode": "Used to identify the institution in the relevant official record; SevaFix does not infer recognition from the name.",
  "student.bankAadhaarSeeded": "Only a yes or no answer is stored. SevaFix does not collect the Aadhaar or bank-account number.",
};

function MarginalField({ field, children }: { field: UiField; children: React.ReactNode }) {
  const note = whyWeAsk[field.key];
  return <div className={`grid gap-3 ${note ? "md:grid-cols-[minmax(0,1fr)_13rem]" : ""}`}><div>{children}</div>{note ? <aside className="border-l-2 border-[var(--rule)] pl-4 text-xs leading-5 text-[var(--ink-2)]"><span className="font-mono font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Why we ask</span><p className="mt-2">{note}</p></aside> : null}</div>;
}

function fieldToInputValue(field: UiField, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (field.type === "boolean") return value ? "true" : "false";
  return String(value);
}

function inputValueToField(field: UiField, raw: string): string | number | boolean | null {
  if (raw === "") return null;
  if (field.type === "boolean") return raw === "true";
  if (field.type === "integer") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (field.type === "number") {
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return raw;
}

function FieldControl({ field, value, onChange }: { field: UiField; value: unknown; onChange: (next: unknown) => void }) {
  const label = `${field.label}${field.required || field.requiredFor ? " *" : ""}`;
  if (field.type === "select") {
    return (
      <MarginalField field={field}><label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">{label}</span>
        <select
          className="w-full border border-[var(--rule-strong)] bg-[var(--sheet)] px-3 py-2.5 text-sm"
          value={fieldToInputValue(field, value)}
          onChange={(event) => onChange(inputValueToField(field, event.target.value))}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </label></MarginalField>
    );
  }

  if (field.type === "boolean") {
    return (
      <MarginalField field={field}><fieldset>
        <legend className="mb-2 text-sm font-semibold text-[var(--ink)]">{label}</legend>
        <div className="flex gap-2">
          {[{ value: "true", label: "Yes" }, { value: "false", label: "No" }].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(inputValueToField(field, option.value))}
              className={`min-h-11 min-w-20 rounded-[2px] border px-3 py-2 text-sm font-semibold ${fieldToInputValue(field, value) === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--rule-strong)] bg-[var(--sheet)] text-[var(--ink-2)] hover:border-[var(--ink-2)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </fieldset></MarginalField>
    );
  }

  if (field.key === "student.familyAnnualIncomeINR") return <MarginalField field={field}><label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">{label}</span><div className="flex border border-[var(--rule-strong)] bg-[var(--sheet)] focus-within:border-[var(--accent)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent-soft)]"><span className="grid min-h-11 w-11 place-items-center border-r border-[var(--rule)] font-mono">₹</span><input className="min-h-11 min-w-0 flex-1 bg-transparent px-3 font-mono outline-none" type="number" min={field.minimum} value={fieldToInputValue(field, value)} onChange={(event) => onChange(inputValueToField(field, event.target.value))} /></div>{field.helpText ? <span className="mt-1 block text-xs text-[var(--ink-2)]">{field.helpText}</span> : null}</label></MarginalField>;

  return (
    <MarginalField field={field}><TextField
      label={label}
      hint={field.helpText}
      type={field.type === "integer" || field.type === "number" ? "number" : "text"}
      min={field.minimum}
      max={field.maximum}
      step={field.type === "integer" ? 1 : field.type === "number" ? "any" : undefined}
      value={fieldToInputValue(field, value)}
      onChange={(event) => onChange(inputValueToField(field, event.target.value))}
    /></MarginalField>
  );
}

export default function EditDraftPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const scheme = useScheme(application.data?.application.schemeId ?? "");
  const saveDraft = useSaveDraft(appId);
  const [fields, setFields] = useState<DraftFields>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const initializedRef = useRef(false);
  const revisionRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeVersionRef = useRef(0);
  const saveLoopRef = useRef<Promise<void> | null>(null);
  const queuedSaveRef = useRef<{ fields: DraftFields; version: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!application.data) return;
    revisionRef.current = application.data.application.revision;
    if (!initializedRef.current) {
      setFields(application.data.application.draftFields ?? {});
      initializedRef.current = true;
    }
  }, [application.data]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function queueSave(nextFields: DraftFields, version: number) {
    queuedSaveRef.current = { fields: nextFields, version };
    if (saveLoopRef.current) return saveLoopRef.current;

    const drain = async () => {
      setIsSaving(true);
      setSaveError(null);
      while (queuedSaveRef.current) {
        const request = queuedSaveRef.current;
        queuedSaveRef.current = null;
        try {
          const updated = await saveDraft.mutateAsync({
            fields: request.fields,
            expectedRevision: revisionRef.current,
          });
          revisionRef.current = updated.revision;
          setLastSavedAt(new Date());
          setMessage(null);
          setDirty(request.version < changeVersionRef.current);
        } catch (error) {
          if (error instanceof SevaFixApiError && error.status === 409) {
            const refreshed = await application.refetch();
            if (refreshed.data) revisionRef.current = refreshed.data.application.revision;
            setMessage("This application changed elsewhere. Your unsaved input is still here. Review it, then choose Save now to retry against the latest revision.");
          } else {
            setSaveError(error instanceof Error ? error.message : "Could not save the draft");
          }
          setDirty(true);
        }
      }
      setIsSaving(false);
    };

    const loop = drain().finally(() => {
      saveLoopRef.current = null;
      // An edit can arrive between the loop's last check and this cleanup.
      if (queuedSaveRef.current) queueSave(queuedSaveRef.current.fields, queuedSaveRef.current.version);
    });
    saveLoopRef.current = loop;
    return loop;
  }

  function scheduleSave(nextFields: DraftFields) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const version = changeVersionRef.current;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void queueSave(nextFields, version);
    }, AUTOSAVE_DELAY_MS);
  }

  function onFieldChange(key: string, value: unknown) {
    const next = { ...fields, [key]: value as DraftFields[string] };
    changeVersionRef.current += 1;
    setFields(next);
    setDirty(true);
    scheduleSave(next);
  }

  async function saveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    await queueSave(fields, changeVersionRef.current);
  }

  if (application.isLoading || (application.data && scheme.isLoading)) return <FullPageSpinner />;
  if (!application.data) return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;
  if (!scheme.data) return <ErrorBanner message={scheme.error instanceof Error ? scheme.error.message : "Scheme workflow not found"} />;

  const sections = schemeSections(scheme.data);
  const allFields = schemeFields(scheme.data);
  return (
    <div>
      <PageHeader
        eyebrow="Application"
        title="Information"
        description="Enter the applicant's details as they appear on official documents. Changes save automatically."
      />
      <ErrorBanner message={message} />
      <ErrorBanner message={saveError} />
      <div className="border-y border-[var(--rule)] bg-[var(--sheet)] px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-2)]">
          <span>Required fields are marked with an asterisk.</span>
          <div className="flex items-center gap-3">
            {dirty ? <span className="font-semibold text-[var(--review)]">Unsaved changes</span> : null}
            <span>{isSaving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not saved yet"}</span>
            <Button variant="secondary" onClick={saveNow} loading={isSaving} disabled={!dirty || isSaving}>Save now</Button>
          </div>
        </div>
      </div>
        <div className="divide-y divide-[var(--rule)] border-b border-[var(--rule)] bg-[var(--sheet)] px-5 sm:px-7">
          {sections.map((section) => {
            const visibleFields = allFields.filter((field) => field.section === section.id && isFieldVisible(field, fields));
            return (
              <section key={section.id} className="grid gap-7 py-8 xl:grid-cols-[220px_1fr]">
                <div><h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]">{section.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">{section.id === "application" ? "Choose the relevant application type." : section.id === "student" ? "Tell us about the applicant." : "Provide the details required by this scheme."}</p></div>
                <div className="grid max-w-3xl gap-y-6">
                  {visibleFields.map((field) => <FieldControl key={field.key} field={field} value={fields[field.key]} onChange={(value) => onFieldChange(field.key, value)} />)}
                </div>
              </section>
            );
          })}
        </div>
    </div>
  );
}
