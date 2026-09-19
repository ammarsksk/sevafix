"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Card, ErrorBanner, PageHeader, TextField } from "@/components/ui";
import { useAuth } from "@/lib/sevafix/auth-context";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setStage("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset(email, code, newPassword);
      router.push(`/login?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader title="Forgot password" />
      <Card>
        {stage === "request" ? (
          <form className="space-y-4" onSubmit={onRequest}>
            <ErrorBanner message={error} />
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send reset code
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onConfirm}>
            <ErrorBanner message={error} />
            <TextField
              label="Verification code"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <TextField
              label="New password"
              type="password"
              hint="At least 10 characters with upper, lower, number, and symbol."
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Reset password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
