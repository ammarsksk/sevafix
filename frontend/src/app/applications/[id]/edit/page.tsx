"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Card, ErrorBanner, FullPageSpinner, TextField } from "@/components/ui";
import { PM_USP_FIELDS, PM_USP_SECTIONS, type FieldConfig } from "@/lib/sevafix/pm-usp-schema";
import { useApplication, useSaveDraft } from "@/lib/sevafix/queries";
import { SevaFixApiError } from "@/lib/sevafix/sevafix-api";
import type { DraftFields } from "@/lib/sevafix/sevafix-types";

const AUTOSAVE_DELAY_MS = 1200;

function fieldToInputValue(field: FieldConfig, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (field.type === "boolean") return value ? "true" : "false";
  return String(value);
}

function inputValueToField(field: FieldConfig, raw: string): string | number | boolean | null {
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

function FieldControl({ field, value, onChange }: { field: FieldConfig; value: unknown; onChange: (next: unknown) => void }) {
  const label = `${field.label}${field.required || field.requiredFor ? " *" : ""}`;
  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-800">{label}</span>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          value={fieldToInputValue(field, value)}
          onChange={(event) => onChange(inputValueToField(field, event.target.value))}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-800">{label}</legend>
        <div className="flex gap-2">
          {[{ value: "true", label: "Yes" }, { value: "false", label: "No" }].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(inputValueToField(field, option.value))}
              className={`rounded-md border px-3 py-1.5 text-sm ${fieldToInputValue(field, value) === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
      </fieldset>
    );
  }

  return (
    <TextField
      label={label}
      hint={field.helpText}
      type={field.type === "integer" || field.type === "number" ? "number" : "text"}
      min={field.minimum}
      max={field.maximum}
      step={field.type === "integer" ? 1 : field.type === "number" ? "any" : undefined}
      value={fieldToInputValue(field, value)}
      onChange={(event) => onChange(inputValueToField(field, event.target.value))}
    />
  );
}

export default function EditDraftPage() {
  const params = useParams<{ id: string }>();
  const appId = params.id;
  const application = useApplication(appId);
  const saveDraft = useSaveDraft(appId);
  const [fields, setFields] = useState<DraftFields>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const initializedRef = useRef(false);
  const revisionRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function save(nextFields: DraftFields) {
    setSaveError(null);
    try {
      const updated = await saveDraft.mutateAsync({ fields: nextFields, expectedRevision: revisionRef.current });
      revisionRef.current = updated.revision;
      setLastSavedAt(new Date());
      setMessage(null);
      setDirty(false);
    } catch (error) {
      if (error instanceof SevaFixApiError && error.status === 409) {
        setMessage("This application changed elsewhere. The latest copy was loaded; please redo your last change.");
        initializedRef.current = false;
        await application.refetch();
      } else {
        setSaveError(error instanceof Error ? error.message : "Could not save the draft");
      }
    }
  }

  function scheduleSave(nextFields: DraftFields) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save(nextFields), AUTOSAVE_DELAY_MS);
  }

  function onFieldChange(key: string, value: unknown) {
    const next = { ...fields, [key]: value as DraftFields[string] };
    setFields(next);
    setDirty(true);
    scheduleSave(next);
  }

  async function saveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await save(fields);
  }

  if (application.isLoading) return <FullPageSpinner />;
  if (!application.data) return <ErrorBanner message={application.error instanceof Error ? application.error.message : "Application not found"} />;

  const applicationType = fields["application.type"];
  return (
    <div>
      <ErrorBanner message={message} />
      <ErrorBanner message={saveError} />
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Fields save automatically. Required fields are marked *.</span>
          <div className="flex items-center gap-3">
            {dirty ? <span className="text-amber-700">Unsaved changes</span> : null}
            <span>{saveDraft.isPending ? "Saving…" : lastSavedAt ? `Last saved ${lastSavedAt.toLocaleTimeString()}` : "Not saved yet"}</span>
            <Button variant="secondary" onClick={saveNow} loading={saveDraft.isPending} disabled={!dirty}>Save now</Button>
          </div>
        </div>
        <div className="space-y-7">
          {PM_USP_SECTIONS.map((section) => {
            const visibleFields = PM_USP_FIELDS.filter((field) => {
              if (field.section !== section.id) return false;
              if (field.requiredFor && applicationType && !field.requiredFor.includes(applicationType as "FRESH" | "RENEWAL")) return false;
              if (field.key === "student.disabilityPercentage" && fields["student.hasBenchmarkDisability"] !== true) return false;
              return true;
            });
            return (
              <section key={section.id}>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">{section.title}</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {visibleFields.map((field) => <FieldControl key={field.key} field={field} value={fields[field.key]} onChange={(value) => onFieldChange(field.key, value)} />)}
                </div>
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
