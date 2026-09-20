"use client";

import { useEffect, useState } from "react";

import styles from "@/app/landing.module.css";

type LandingScheme = {
  schemeId: string;
  name: string;
  authority?: string;
  activePolicyVersionId?: string;
  updatedAt?: string;
  status?: string;
  officialPortalUrl?: string;
};

const fallback: LandingScheme[] = [{
  schemeId: "pm-usp-csss",
  name: "PM-USP Central Sector Scholarship",
  authority: "Department of Higher Education, Ministry of Education",
  activePolicyVersionId: "pm-usp-csss-2026-27.3",
  updatedAt: "2026-09-19",
  status: "ACTIVE",
  officialPortalUrl: "https://scholarships.gov.in/",
}];

export function LandingSchemes() {
  const [schemes, setSchemes] = useState(fallback);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SEVAFIX_API_URL?.replace(/\/$/, "");
    if (!baseUrl) return;
    const controller = new AbortController();
    fetch(`${baseUrl}/schemes`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { items?: LandingScheme[] }) => { if (payload.items?.length) setSchemes(payload.items); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.schemeTable}>
        <thead><tr><th>Scheme</th><th>Authority</th><th>Policy version</th><th>Last verified</th><th>Status</th><th>Official portal</th></tr></thead>
        <tbody>{schemes.map((scheme) => <tr key={scheme.schemeId}><td className="font-semibold">{scheme.name}</td><td>{scheme.authority ?? "Department of Higher Education, Ministry of Education"}</td><td className="font-mono text-xs">{scheme.activePolicyVersionId ?? "See application"}</td><td className="font-mono text-xs">{scheme.updatedAt ? new Date(scheme.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "See application"}</td><td><span className="inline-flex items-center gap-2 font-semibold text-[var(--pass)]"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--pass)]" />Ready</span></td><td><a href={scheme.officialPortalUrl ?? "https://scholarships.gov.in/"} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">Open portal ↗</a></td></tr>)}</tbody>
      </table>
    </div>
  );
}
