"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthFrame } from "@/components/auth-frame";
import { AppIcon } from "@/components/icons";
import { Button, ErrorBanner, TextField } from "@/components/ui";
import { isGoogleSignInConfigured } from "@/lib/sevafix/amplify-auth";
import { useAuth } from "@/lib/sevafix/auth-context";

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(10, "At least 10 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a symbol"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await signUp(values.email, values.password);
      router.push(`/confirm-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    }
  }

  async function onGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-up");
      setGoogleLoading(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Get started"
      title="Create your SevaFix account"
      description="Start a private workspace for your applications. We only ask for what is needed to secure your account."
      footer={<span>Already have an account? <Link href="/login" className="font-bold text-blue-700 hover:text-blue-800">Log in</Link></span>}
    >
        <ErrorBanner message={error} />
        {isGoogleSignInConfigured ? (
          <>
            <Button type="button" variant="secondary" className="w-full" loading={googleLoading} onClick={onGoogleSignUp}>
              <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--rule)] text-[11px] font-bold text-[#4285f4]">G</span>
              Continue with Google
            </Button>
            <div className="relative my-5 text-center text-xs text-[var(--ink-2)]">
              <span className="relative z-10 bg-[var(--sheet)] px-3">or create an account with email</span>
              <span className="absolute inset-x-0 top-1/2 border-t border-[var(--rule)]" />
            </div>
          </>
        ) : null}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters with upper, lower, number, and symbol."
            error={errors.password?.message}
            {...register("password")}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create account <AppIcon name="arrow-right" size={16} />
          </Button>
        </form>
    </AuthFrame>
  );
}
