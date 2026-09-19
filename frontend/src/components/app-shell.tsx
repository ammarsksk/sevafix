"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/sevafix/auth-context";

import { Button } from "./ui";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/schemes", label: "New application" },
  { href: "/grievances", label: "Grievance" },
  { href: "/settings", label: "Settings" },
];

const reviewerNavItems = [
  { href: "/review/source-changes", label: "Source changes" },
  { href: "/review/policies", label: "Policies" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { status, isReviewer, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const authed = status === "authenticated";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={authed ? "/dashboard" : "/"} className="text-lg font-semibold text-slate-900">
            SevaFix
          </Link>
          {authed ? (
            <nav className="flex items-center gap-1">
              {[...navItems, ...(isReviewer ? reviewerNavItems : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    pathname?.startsWith(item.href)
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Button
                variant="ghost"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                Sign out
              </Button>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
