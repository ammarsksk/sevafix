"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button, Card, ErrorBanner, PageHeader, TextField } from "@/components/ui";
import { useAuth } from "@/lib/sevafix/auth-context";

export default function ConfirmEmailPage() {
  return (
    <Suspense>
      <ConfirmEmailForm />
    </Suspense>
  );
}
function ConfirmEmailForm() {
  const { confirmEmail, resendConfirmationCode } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await confirmEmail(email, code);
      router.push(`/login?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm email");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendConfirmationCode(email);
      setInfo("A new code has been sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader
        title="Confirm your email"
        description="Enter the verification code we sent to your inbox."
      />
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <ErrorBanner message={error} />
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Verification code"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Confirm
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            loading={resending}
            onClick={onResend}
          >
            Resend code
          </Button>
        </form>
      </Card>
    </div>
  );
}

