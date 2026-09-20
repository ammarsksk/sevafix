"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { AppIcon } from "@/components/icons";
import { Button, ErrorBanner, TextField } from "@/components/ui";
import { isGoogleSignInConfigured } from "@/lib/sevafix/amplify-auth";
import { useAuth } from "@/lib/sevafix/auth-context";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not log in";
      if (message.toLowerCase().includes("not confirmed")) {
        router.push(`/confirm-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in");
      setGoogleLoading(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Continue your application"
      description="Sign in to return to your saved forms, documents, checks, and diagnoses."
      footer={<div className="flex justify-between gap-4"><Link href="/forgot-password" className="font-semibold text-slate-600 hover:text-blue-700">Forgot password?</Link><Link href="/signup" className="font-bold text-blue-700 hover:text-blue-800">Create an account</Link></div>}
    >
        <form className="space-y-4" onSubmit={onSubmit}>
          <ErrorBanner message={error} />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Log in <AppIcon name="arrow-right" size={16} />
          </Button>
          {isGoogleSignInConfigured ? (
            <>
              <div className="relative py-1 text-center text-xs text-slate-500">
                <span className="relative z-10 bg-white px-2">or continue with</span>
                <span className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-200" />
              </div>
              <Button type="button" variant="secondary" className="w-full" loading={googleLoading} onClick={onGoogleSignIn}>
                Continue with Google
              </Button>
            </>
          ) : null}
        </form>
    </AuthFrame>
  );
}
