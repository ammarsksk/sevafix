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

const fallback: LandingScheme[] = [
  {
    schemeId: "ab-pmjay",
    name: "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
    authority: "National Health Authority, Ministry of Health and Family Welfare",
    activePolicyVersionId: "ab-pmjay-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmjay.gov.in/",
  },
  {
    schemeId: "nsap",
    name: "National Social Assistance Programme",
    authority: "Department of Rural Development, Ministry of Rural Development",
    activePolicyVersionId: "nsap-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://nsap.nic.in/",
  },
  {
    schemeId: "pm-kisan",
    name: "Pradhan Mantri Kisan Samman Nidhi",
    authority: "Department of Agriculture and Farmers Welfare, Ministry of Agriculture and Farmers Welfare",
    activePolicyVersionId: "pm-kisan-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmkisan.gov.in/",
  },
  {
    schemeId: "pm-svanidhi",
    name: "Prime Minister Street Vendor's AtmaNirbhar Nidhi",
    authority: "Ministry of Housing and Urban Affairs",
    activePolicyVersionId: "pm-svanidhi-precheck-2026.2",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmsvanidhi.mohua.gov.in/",
  },
  {
    schemeId: "pm-usp-csss",
    name: "PM-USP Central Sector Scheme of Scholarship for College and University Students",
    authority: "Department of Higher Education, Ministry of Education",
    activePolicyVersionId: "pm-usp-csss-2026-27.3",
    updatedAt: "2026-09-19",
    status: "ACTIVE",
    officialPortalUrl: "https://scholarships.gov.in/",
  },
  {
    schemeId: "pm-vishwakarma",
    name: "PM Vishwakarma",
    authority: "Ministry of Micro, Small and Medium Enterprises",
    activePolicyVersionId: "pm-vishwakarma-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmvishwakarma.gov.in/",
  },
  {
    schemeId: "pmay-g",
    name: "Pradhan Mantri Awaas Yojana - Gramin",
    authority: "Department of Rural Development, Ministry of Rural Development",
    activePolicyVersionId: "pmay-g-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmayg.nic.in/",
  },
  {
    schemeId: "pmay-u-2",
    name: "Pradhan Mantri Awas Yojana - Urban 2.0",
    authority: "Ministry of Housing and Urban Affairs",
    activePolicyVersionId: "pmay-u-2-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmaymis.gov.in/PMAYMIS2_2024/PmayDefault.aspx",
  },
  {
    schemeId: "pmmvy",
    name: "Pradhan Mantri Matru Vandana Yojana",
    authority: "Ministry of Women and Child Development",
    activePolicyVersionId: "pmmvy-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://pmmvy.wcd.gov.in/",
  },
  {
    schemeId: "pmuy",
    name: "Pradhan Mantri Ujjwala Yojana",
    authority: "Ministry of Petroleum and Natural Gas",
    activePolicyVersionId: "pmuy-precheck-2026.1",
    updatedAt: "2026-09-20",
    status: "ACTIVE",
    officialPortalUrl: "https://www.pmuy.gov.in/",
  },
];

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
        <tbody>{schemes.map((scheme) => <tr key={scheme.schemeId}><td className="font-semibold">{scheme.name}</td><td>{scheme.authority ?? "Official scheme authority"}</td><td className="font-mono text-xs">{scheme.activePolicyVersionId ?? "See application"}</td><td className="font-mono text-xs">{scheme.updatedAt ? new Date(scheme.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "See application"}</td><td><span className="inline-flex items-center gap-2 font-semibold text-[var(--pass)]"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--pass)]" />Ready</span></td><td>{scheme.officialPortalUrl ? <a href={scheme.officialPortalUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">Open portal ↗</a> : <span className="text-[var(--ink-2)]">See application</span>}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
