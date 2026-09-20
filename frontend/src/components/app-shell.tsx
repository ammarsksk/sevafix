"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/sevafix/auth-context";

import styles from "./authenticated-shell.module.css";
import { Brand } from "./brand";
import { CommandMenu } from "./command-menu";
import { LandingHeader } from "./landing-header";

const navItems = [
  { href: "/dashboard", label: "Applications" },
  { href: "/schemes", label: "Schemes" },
  { href: "/grievances", label: "Diagnose" },
  { href: "/settings", label: "Settings" },
];

const reviewerNavItems = [
  { href: "/review/source-changes", label: "Source changes" },
  { href: "/review/policies", label: "Policy publishing" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.navActive : ""}`}>{label}</Link>;
}
export function AppShell({ children }: { children: ReactNode }) {
  const { status, isReviewer, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const authed = status === "authenticated";
  const home = pathname === "/";
  const reviewer = pathname.startsWith("/review/");
  const fullBleed = home || pathname === "/specimen" || pathname === "/lab" || reviewer;
  const allNavItems = reviewer ? [{ href: "/dashboard", label: "Citizen workspace" }, ...reviewerNavItems] : [...navItems, ...(isReviewer ? reviewerNavItems : [])];

  if (home && !authed) return <div className="min-h-screen bg-[var(--paper)]"><LandingHeader /><main className="w-full">{children}</main></div>;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className={`${styles.header} ${reviewer ? styles.reviewerHeader : ""}`}>
        <div className={`${styles.row} mx-auto max-w-[1440px]`}>
          <Brand href={authed ? "/dashboard" : "/"} />
          {authed ? <nav className={styles.nav} aria-label="Primary navigation">{allNavItems.map((item) => <NavLink key={item.href} {...item} active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))} />)}</nav> : null}
          {authed ? <div className={styles.actions}><CommandMenu /><button type="button" className={styles.signOut} onClick={async () => { await signOut(); router.replace("/login"); }}>Sign out</button></div> : <div className={styles.actions}><Link href="/login" className={styles.signOut}>Sign in</Link></div>}
        </div>
        {authed ? <nav className={styles.mobileNav} aria-label="Primary navigation">{allNavItems.map((item) => <NavLink key={item.href} {...item} active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))} />)}</nav> : null}
      </header>
      <main className={fullBleed ? styles.fullBleed : styles.main}>{children}</main>
    </div>
  );
}

