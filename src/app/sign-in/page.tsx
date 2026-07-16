"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.075.035c-.211.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.07.07 0 0 0-.075-.036A19.74 19.74 0 0 0 3.68 4.37a.064.064 0 0 0-.03.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.106c.36.698.772 1.363 1.225 1.994a.077.077 0 0 0 .084.028 19.84 19.84 0 0 0 6.003-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.673-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.2.66.79.55A10.51 10.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedParam = searchParams.get("verified");
  const resetParam = searchParams.get("reset");
  const emailParam = searchParams.get("email");

  const [activeTab, setActiveTab] = useState<"password" | "otp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [email, setEmail] = useState(emailParam ?? "");
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState<string | null>(
    verifiedParam ? null : resetParam ? null : null
  );
  const [success, setSuccess] = useState<string | null>(
    verifiedParam
      ? "Email verified successfully! You can now sign in."
      : resetParam
      ? "Password reset successfully! Please sign in."
      : null
  );
  const [busy, setBusy] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Check if the user is unverified by calling our verification-check helper
        try {
          const checkRes = await fetch(`/api/auth/verify-needed?username=${encodeURIComponent(username)}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (!checkData.verified) {
              setError("Your email is not verified yet. Redirecting to verification...");
              setTimeout(() => {
                router.push(`/verify-email?email=${encodeURIComponent(checkData.email)}`);
              }, 2000);
              return;
            }
          }
        } catch {}

        setError("Wrong username or password.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/send-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to send code.");
        return;
      }

      setOtpSent(true);
      setSuccess("We sent a 6-digit sign-in code to your email.");
      setCooldown(60);
    } catch {
      setError("An error occurred. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter the complete 6-digit code.");
      return;
    }

    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await signIn("credentials", {
        email,
        otp: code,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid or expired code. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleOtpChange(value: string, index: number) {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const pasteOtp = pasteData.split("");
      setOtp(pasteOtp);
      inputRefs.current[5]?.focus();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <GlimpseOrb className="-z-10" />
        <GlassCard strong className="w-full max-w-sm p-8">
          <h1 className="mb-1 font-display text-2xl font-medium">Welcome back</h1>
          <p className="mb-6 text-sm text-mist">
            Sign in to save your profile, join private rooms, and connect with other users.
          </p>

          {/* Liquid glass styled Tab headers */}
          <div className="mb-6 flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("password");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "password"
                  ? "bg-white/10 text-ink border border-white/10 shadow-sm"
                  : "text-mist-dim hover:text-mist"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => {
                setActiveTab("otp");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "otp"
                  ? "bg-white/10 text-ink border border-white/10 shadow-sm"
                  : "text-mist-dim hover:text-mist"
              }`}
            >
              Email OTP
            </button>
          </div>

          {activeTab === "password" ? (
            <form onSubmit={handleCredentials} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-mist underline underline-offset-4 hover:text-ink"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? <p className="text-sm text-mist">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
              <Button type="submit" disabled={busy} className="mt-1 w-full">
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={otpSent}
                  />
                  {!otpSent && (
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={busy || !email}
                      className="whitespace-nowrap px-4"
                    >
                      Send Code
                    </Button>
                  )}
                </div>
              </div>

              {otpSent && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col gap-1.5 items-center">
                    <Label className="self-start">Sign-in Code</Label>
                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
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
                          onChange={(e) => handleOtpChange(e.target.value, idx)}
                          onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                          className="w-10 h-12 text-center text-xl font-semibold bg-white/5 border border-white/10 rounded-xl focus:border-white/30 focus:bg-white/10 focus:ring-1 focus:ring-white/20 transition-all outline-none text-ink"
                        />
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={busy || otp.some((d) => !d)} className="w-full">
                    {busy ? "Signing in..." : "Confirm Sign-in"}
                  </Button>

                  <div className="text-center text-xs">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={cooldown > 0}
                      className={`underline underline-offset-4 ${
                        cooldown > 0 ? "text-mist-dim cursor-not-allowed" : "text-ink hover:text-mist"
                      }`}
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                  </div>
                </div>
              )}

              {error ? <p className="text-sm text-mist text-center">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400 text-center">{success}</p> : null}
            </form>
          )}

          <p className="mt-4 text-center text-sm text-mist-dim">
            New here?{" "}
            <Link href="/sign-up" className="text-ink underline underline-offset-4">
              Create an account
            </Link>
          </p>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-mist-dim">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="secondary"
              className="w-full !bg-white/10 text-ink hover:!bg-white/15"
              onClick={() => signIn("discord")}
            >
              <DiscordIcon />
              Continue with Discord
            </Button>
            <Button
              variant="secondary"
              className="w-full !bg-white/10 text-ink hover:!bg-white/15"
              onClick={() => signIn("github")}
            >
              <GithubIcon />
              Continue with GitHub
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-mist-dim">
            By continuing you agree to Glimpse&apos;s{" "}
            <a href="/terms" className="underline hover:text-mist">Terms</a> and{" "}
            <a href="/privacy" className="underline hover:text-mist">Privacy Policy</a>.
          </p>
        </GlassCard>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="relative flex flex-1 items-center justify-center px-6 py-10">
          <GlimpseOrb className="-z-10" />
          <GlassCard strong className="w-full max-w-sm p-8 flex items-center justify-center">
            <div className="animate-pulse text-mist">Loading sign in...</div>
          </GlassCard>
        </main>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
