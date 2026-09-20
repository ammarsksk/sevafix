import { PM_USP_FIELDS, PM_USP_SECTIONS, evidenceTypesFor as pmUspEvidenceTypes } from "./pm-usp-schema";
import type { DraftFields, Scheme, SchemeDocumentRequirement, SchemeFormField } from "./sevafix-types";

export interface UiField extends Omit<SchemeFormField, "options"> {
  section: string;
  options?: Array<{ value: string; label: string }>;
}

const humanize = (value: string) =>
  value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function schemeSections(scheme?: Scheme) {
  if (!scheme?.formSchema?.sections?.length) return PM_USP_SECTIONS.map((section) => ({ ...section }));
  return scheme.formSchema.sections.map(({ id, title }) => ({ id, title }));
}

export function schemeFields(scheme?: Scheme): UiField[] {
  if (!scheme?.formSchema?.sections?.length) return PM_USP_FIELDS;
  return scheme.formSchema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      ...field,
      section: section.id,
      options: field.options?.map((option) =>
        typeof option === "string" ? { value: option, label: humanize(option) } : option,
      ),
    })),
  );
}

export function isFieldVisible(field: UiField, fields: DraftFields) {
  const applicationType = fields["application.type"];
  if (field.requiredFor?.length && applicationType && !field.requiredFor.includes(String(applicationType))) return false;
  if (field.visibleWhen && fields[field.visibleWhen.field] !== field.visibleWhen.equals) return false;
  // Compatibility with the original PM-USP schema.
  if (field.key === "student.disabilityPercentage" && fields["student.hasBenchmarkDisability"] !== true) return false;
  return true;
}

function checklistKey(scheme: Scheme, fields: DraftFields) {
  const requested = fields["application.type"];
  if (requested && scheme.documentChecklist?.[String(requested)]) return String(requested);
  const supported = scheme.supportedApplicationTypes?.[0];
  if (supported && scheme.documentChecklist?.[supported]) return supported;
  return Object.keys(scheme.documentChecklist ?? {})[0];
}

export function evidenceTypesForScheme(scheme: Scheme | undefined, fields: DraftFields) {
  if (!scheme?.documentChecklist) return pmUspEvidenceTypes(fields);
  const key = checklistKey(scheme, fields);
  const documents: SchemeDocumentRequirement[] = key ? scheme.documentChecklist[key] ?? [] : [];
  return documents.map((document) => ({
    value: document.documentType,
    label: `${document.label}${document.requiredWhen ? " (if applicable)" : ""}`,
    required: Boolean(document.required || document.requiredBySevaFix),
  }));
}
