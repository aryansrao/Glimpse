"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to send reset code. Please try again.");
        return;
      }

      setSuccess("A password reset code has been sent to your email.");
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <GlimpseOrb className="-z-10" />
        <GlassCard strong className="w-full max-w-sm p-8">
          <h1 className="mb-1 font-display text-2xl font-medium text-ink">Forgot password</h1>
          <p className="mb-6 text-sm text-mist">
            Enter your email address and we will send you a 6-digit code to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {error ? <p className="text-sm text-mist">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Sending..." : "Send Reset Code"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-mist-dim">
            Remembered your password?{" "}
            <Link href="/sign-in" className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </GlassCard>
      </main>
    </div>
  );
}
