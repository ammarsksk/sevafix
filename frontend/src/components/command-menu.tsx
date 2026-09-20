"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useApplications, useSchemes } from "@/lib/sevafix/queries";

import styles from "./authenticated-shell.module.css";

const destinations = [
  ["Applications", "/dashboard", "G D"],
  ["Supported schemes", "/schemes", "G S"],
  ["Diagnose a rejection", "/grievances", "G R"],
  ["Settings", "/settings", "G ,"],
] as const;

const stages = [
  ["Form", "edit"], ["Documents", "documents"], ["Checks", "check"], ["Review", "review"], ["Submission and tracking", "tracking"], ["Diagnose", "diagnose"],
] as const;

export function CommandMenu() {
  const router = useRouter();
  const applications = useApplications();
  const schemes = useSchemes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => { if (value) setQuery(""); return !value; }); }
      if (event.key === "Escape") { setOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const applicationItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = applications.data?.items ?? [];
    const schemeNames = new Map((schemes.data?.items ?? []).map((scheme) => [scheme.schemeId, scheme.name]));
    return items.flatMap((application) => stages.map(([label, segment]) => ({
      label: `${label} · ${schemeNames.get(application.schemeId) ?? application.schemeId}`,
      meta: application.appId.slice(-8),
      href: `/applications/${application.appId}/${segment}`,
    }))).filter((item) => !needle || `${item.label} ${item.meta}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [applications.data?.items, query, schemes.data?.items]);

  const filteredDestinations = destinations.filter(([label]) => !query || label.toLowerCase().includes(query.toLowerCase()));
  const close = () => { setOpen(false); setQuery(""); };
  const go = (href: string) => { close(); router.push(href); };

  return (
    <>
      <button type="button" className={styles.commandButton} onClick={() => setOpen(true)} aria-haspopup="dialog"><span>Jump to</span><span className={styles.key}>Ctrl K</span></button>
      {open ? <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className={styles.commandDialog} role="dialog" aria-modal="true" aria-label="Jump to an application or stage"><input ref={inputRef} className={styles.commandInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applications or stages" /><div className={styles.commandList}>{filteredDestinations.length ? <div className={styles.commandGroup}><p className={styles.commandLabel}>Workspace</p>{filteredDestinations.map(([label, href, key]) => <button key={href} type="button" className={styles.commandItem} onClick={() => go(href)}><span>{label}</span><span className={styles.commandMeta}>{key}</span></button>)}</div> : null}<div className={styles.commandGroup}><p className={styles.commandLabel}>Applications and stages</p>{applications.isLoading || schemes.isLoading ? <p className="px-4 py-3 text-sm text-[var(--ink-2)]">Loading applications…</p> : applicationItems.length ? applicationItems.map((item) => <button key={item.href} type="button" className={styles.commandItem} onClick={() => go(item.href)}><span>{item.label}</span><span className={styles.commandMeta}>{item.meta}</span></button>) : <p className="px-4 py-3 text-sm text-[var(--ink-2)]">No matching application stage.</p>}</div></div></div></div> : null}
    </>
  );
}
