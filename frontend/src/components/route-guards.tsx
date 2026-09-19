"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/sevafix/auth-context";

import { FullPageSpinner } from "./ui";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <FullPageSpinner />;
  return <>{children}</>;
}

export function ReviewerRoute({ children }: { children: ReactNode }) {
  const { status, isReviewer } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && !isReviewer) router.replace("/dashboard");
  }, [status, isReviewer, router]);

  if (status !== "authenticated" || !isReviewer) return <FullPageSpinner />;
  return <>{children}</>;
}
