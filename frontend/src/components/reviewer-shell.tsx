"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ReviewerRoute } from "@/components/route-guards";

import styles from "./reviewer-console.module.css";

const routes = [
  { href: "/review/source-changes", label: "01 / Source queue" },
  { href: "/review/policies", label: "02 / Policy versions" },
];

export function ReviewerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ReviewerRoute>
      <div className={styles.console}>
        <div className={styles.shell}>
          <aside className={styles.rail}>
            <p className={styles.railLabel}>Restricted workspace</p>
            <p className={styles.railTitle}>Policy review console</p>
            <nav className={styles.railNav} aria-label="Reviewer console">
              {routes.map((route) => <Link key={route.href} href={route.href} aria-current={pathname.startsWith(route.href) ? "page" : undefined} className={`${styles.railLink} ${pathname.startsWith(route.href) ? styles.railLinkActive : ""}`}>{route.label}</Link>)}
            </nav>
            <p className={styles.railNote}>All consequential actions are attributed to the signed-in reviewer. Published versions are immutable.</p>
          </aside>
          <div className={styles.content}>{children}</div>
        </div>
      </div>
    </ReviewerRoute>
  );
}
