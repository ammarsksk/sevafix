"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button, Card, FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/lib/sevafix/auth-context";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-semibold text-slate-900">
        Prepare a stronger government scheme application
      </h1>
      <p className="mt-3 text-slate-600">
        SevaFix helps you fill out, verify, and check your PM-USP scholarship application before
        you submit it on the official portal. It does not submit on your behalf or guarantee
        approval.
      </p>
      <Card className="mt-8 flex flex-col items-center gap-3">
        <Button onClick={() => router.push("/signup")} className="w-full max-w-xs">
          Create an account
        </Button>
        <Button variant="secondary" onClick={() => router.push("/login")} className="w-full max-w-xs">
          Log in
        </Button>
      </Card>
    </div>
  );
}
