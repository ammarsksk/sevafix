"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

import { AppIcon } from "@/components/icons";
import { chipClassName, type ChipSpec } from "@/lib/status";

export function StatusChip({ spec }: { spec: ChipSpec }) {
  const mark = spec.tone === "success" ? "✓" : spec.tone === "danger" ? "×" : spec.tone === "warning" ? "◐" : "—";
  return <span className={chipClassName(spec.tone)}><span aria-hidden="true" className="font-mono text-[0.68rem]">{mark}</span>{spec.label}</span>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-y border-[var(--rule)] bg-[var(--sheet)] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-2)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:border-[var(--neutral)] disabled:bg-[var(--neutral)]",
  secondary:
    "bg-transparent text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:text-[var(--neutral)]",
  danger: "border border-[var(--fail)] bg-[var(--fail)] text-white hover:bg-[#8f2c23] disabled:bg-red-300",
  ghost: "border border-transparent bg-transparent text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline disabled:text-[var(--neutral)]",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
      aria-hidden="true"
    />
  );
}

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[44vh] flex-col items-center justify-center gap-4 text-slate-500">
      <span className="grid h-11 w-11 place-items-center rounded-[2px] border border-[var(--rule)] bg-[var(--sheet)]">
        <Spinner />
      </span>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">{label}</span>
      <input
        className={`min-h-11 w-full rounded-[2px] border bg-[var(--sheet)] px-3.5 py-2.5 text-[0.95rem] text-[var(--ink)] outline-none transition placeholder:text-[var(--neutral)] focus:ring-3 ${
          error ? "border-[var(--fail)] focus:ring-red-100" : "border-[var(--rule-strong)] hover:border-[var(--ink-2)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]"
        } ${className}`}
        {...rest}
      />
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-[var(--ink-2)]">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-3 flex items-start gap-2.5 border-l-2 border-[var(--fail)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-5 text-[var(--fail)]">
      <AppIcon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] underline decoration-[var(--rule-strong)] hover:decoration-[var(--accent)]">
      {children}<AppIcon name="arrow-right" size={15} />
    </Link>
  );
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirm",
  requireText,
  danger = false,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  requireText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = !requireText || typed === requireText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_68%,transparent)] p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-[3px] border border-[var(--rule-strong)] bg-[var(--sheet)] p-6 shadow-xl">
        <h2 id="confirm-dialog-title" className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-2)]">{description}</div>
        {requireText ? (
          <div className="mt-4">
            <TextField
              label={`Type "${requireText}" to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={!canConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

