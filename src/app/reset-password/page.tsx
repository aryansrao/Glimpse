"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.push("/forgot-password");
    }
  }, [email, router]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  function handleChange(value: string, index: number) {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next field
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const pasteOtp = pasteData.split("");
      setOtp(pasteOtp);
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to reset password.");
        return;
      }

      setSuccess("Password updated successfully! Redirecting to sign in...");
      setTimeout(() => {
        router.push(`/sign-in?reset=true&email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/forgot-password/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to resend code.");
        return;
      }

      setSuccess("A new reset code has been sent to your email.");
      setCooldown(60);
    } catch {
      setError("An error occurred. Please try again.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <GlimpseOrb className="-z-10" />
        <GlassCard strong className="w-full max-w-md p-8 sm:p-10">
          <h1 className="font-display text-2xl font-medium text-ink text-center">
            Reset password
          </h1>
          <p className="mt-2 text-sm text-mist text-center">
            Enter the 6-digit code sent to
            <br />
            <span className="font-medium text-ink">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 items-center">
              <Label className="self-start">Reset Code</Label>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e.target.value, idx)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    className="w-12 h-14 text-center text-2xl font-semibold bg-white/5 border border-white/10 rounded-xl focus:border-white/30 focus:bg-white/10 focus:ring-1 focus:ring-white/20 transition-all outline-none text-ink"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                minLength={8}
              />
            </div>

            {error ? <p className="text-sm text-mist text-center">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-400 text-center">{success}</p> : null}

            <Button type="submit" disabled={busy || otp.some(d => !d)} className="w-full">
              {busy ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center">
            <span className="text-mist-dim">Didn&apos;t get the code? </span>
            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className={`underline underline-offset-4 font-medium transition-all ${
                cooldown > 0 ? "text-mist-dim cursor-not-allowed" : "text-ink hover:text-mist"
              }`}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="relative flex flex-1 items-center justify-center px-6 py-10">
          <GlimpseOrb className="-z-10" />
          <GlassCard strong className="w-full max-w-md p-8 sm:p-10 flex items-center justify-center">
            <div className="animate-pulse text-mist">Loading password reset...</div>
          </GlassCard>
        </main>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
