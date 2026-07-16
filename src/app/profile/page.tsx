"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RefreshDouble as Loader2,
  Check,
  Copy,
  Discord,
  Github,
  LogOut,
  Mail,
  OpenNewWindow,
  SendMail,
  ShieldCheck,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { GlassCard } from "@/components/glass/glass-card";
import { AvatarUploader } from "@/components/auth/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { absoluteUrl } from "@/lib/site";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const MAX_TAGS = 8;
const MAX_BIO = 300;

type Profile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  tags: string[];
  isPublic: boolean;
  email: string;
  emailIsPlaceholder: boolean;
  emailVerified: boolean;
  discordLinked: boolean;
  githubLinked: boolean;
  hasPassword: boolean;
};

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs uppercase tracking-wide text-mist-dim">{children}</p>
  );
}

export default function ProfilePage() {
  const { status, update } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Editable profile fields
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Username availability — result of the last remote check, keyed by the
  // handle it was for. `available: null` means the check itself failed.
  const [handleCheck, setHandleCheck] = useState<{
    handle: string;
    available: boolean | null;
  } | null>(null);

  // Email + OTP
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [otpStage, setOtpStage] = useState<"idle" | "code">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
  }, [status, router]);

  const applyProfile = useCallback((p: Profile) => {
    setProfile(p);
    setName(p.name);
    setHandle(p.handle);
    setBio(p.bio);
    setTags(p.tags);
    setIsPublic(p.isPublic);
    setEmailDraft(p.emailIsPlaceholder ? "" : p.email);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error();
        const data: Profile = await res.json();
        if (!cancelled) applyProfile(data);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, applyProfile]);

  // Debounced remote username availability check; the visible status is
  // derived below so no state is set synchronously in this effect.
  useEffect(() => {
    if (!profile) return;
    const candidate = handle.trim().toLowerCase();
    if (candidate === profile.handle || !HANDLE_RE.test(candidate)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/username?check=${encodeURIComponent(candidate)}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setHandleCheck({ handle: candidate, available: Boolean(data.available) });
        }
      } catch {
        // Network hiccup — unknown; the PATCH still validates server-side.
        if (!cancelled) setHandleCheck({ handle: candidate, available: null });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle, profile]);

  const candidateHandle = handle.trim().toLowerCase();
  const handleStatus: HandleStatus =
    !profile || candidateHandle === profile.handle
      ? "idle"
      : !HANDLE_RE.test(candidateHandle)
        ? "invalid"
        : handleCheck?.handle === candidateHandle
          ? handleCheck.available === null
            ? "idle"
            : handleCheck.available
              ? "available"
              : "taken"
          : "checking";

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (!tag) return;
    setTags((prev) => {
      if (prev.includes(tag)) return prev;
      if (prev.length >= MAX_TAGS) {
        toast.error(`Up to ${MAX_TAGS} tags.`);
        return prev;
      }
      return [...prev, tag];
    });
    setTagDraft("");
  }

  async function saveProfile() {
    if (!profile) return;
    const candidate = handle.trim().toLowerCase();
    if (handleStatus === "taken" || handleStatus === "invalid") {
      toast.error(
        handleStatus === "taken"
          ? "That username is already taken."
          : "Usernames are 3-20 characters: a-z, 0-9, underscores."
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          handle: candidate,
          bio: bio.trim(),
          tags,
          isPublic,
        }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Couldn't save your profile."));
        return;
      }
      const data: Profile = await res.json();
      applyProfile(data);
      await update();
      toast.success("Profile saved.");
    } catch {
      toast.error("Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!profile) return;
    const email = emailDraft.trim().toLowerCase();
    if (!email) return;
    setEmailSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Couldn't save that email."));
        return;
      }
      const data: Profile = await res.json();
      applyProfile(data);
      setOtpStage("idle");
      setOtpCode("");
      await update();
      toast.success(
        data.emailVerified ? "Email saved." : "Email saved — verify it below."
      );
    } catch {
      toast.error("Couldn't save that email.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function sendCode() {
    setOtpBusy(true);
    try {
      const res = await fetch("/api/auth/otp/send", { method: "POST" });
      if (!res.ok) {
        toast.error(await readError(res, "Couldn't send the code."));
        return;
      }
      setOtpStage("code");
      setOtpCode("");
      setCooldown(60);
      toast.success("Code sent — check your inbox.");
    } catch {
      toast.error("Couldn't send the code.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setOtpBusy(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Couldn't verify that code."));
        return;
      }
      setProfile((p) => (p ? { ...p, emailVerified: true } : p));
      setOtpStage("idle");
      setOtpCode("");
      await update();
      toast.success("Email verified.");
    } catch {
      toast.error("Couldn't verify that code.");
    } finally {
      setOtpBusy(false);
    }
  }

  function copyProfileUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  const profileUrl = profile ? absoluteUrl(`/u/${profile.handle}`) : "";
  const handleChanged = profile ? handle.trim().toLowerCase() !== profile.handle : false;
  const showEmailVerify =
    profile && !profile.emailIsPlaceholder && !profile.emailVerified;

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 justify-center px-6 py-10 sm:py-14">
        <GlimpseOrb className="-z-10" />

        {status === "loading" || (!profile && !loadFailed) ? (
          <div className="flex items-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink/70" />
          </div>
        ) : loadFailed || !profile ? (
          <GlassCard strong className="h-fit w-full max-w-lg p-8 text-center">
            <p className="text-sm text-mist">
              Couldn&apos;t load your profile. Refresh to try again.
            </p>
          </GlassCard>
        ) : (
          <div className="flex w-full max-w-lg flex-col gap-6">
            {/* ------------------------------------------------ Profile */}
            <GlassCard strong className="p-8">
              <h1 className="mb-6 font-display text-2xl font-medium">Your profile</h1>
              <AvatarUploader />

              <div className="mt-8 flex flex-col gap-5 border-t border-white/5 pt-6">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={name}
                    maxLength={50}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="handle">Username</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] text-mist-dim">
                      @
                    </span>
                    <Input
                      id="handle"
                      value={handle}
                      maxLength={20}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="pl-9 pr-10"
                      onChange={(e) =>
                        setHandle(e.target.value.toLowerCase().replace(/\s/g, ""))
                      }
                    />
                    <span className="absolute inset-y-0 right-4 flex items-center">
                      {handleStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-mist-dim" />
                      )}
                      {handleStatus === "available" && (
                        <Check className="h-4 w-4 text-ink" />
                      )}
                      {(handleStatus === "taken" || handleStatus === "invalid") && (
                        <Xmark className="h-4 w-4 text-mist-dim" />
                      )}
                    </span>
                  </div>
                  {handleStatus === "invalid" ? (
                    <p className="text-xs text-mist-dim">
                      3-20 characters: lowercase letters, numbers, underscores.
                    </p>
                  ) : handleStatus === "taken" ? (
                    <p className="text-xs text-mist-dim">
                      That username is already taken.
                    </p>
                  ) : handleChanged ? (
                    <p className="flex items-start gap-1.5 text-xs text-mist-dim">
                      <WarningTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Changing your username changes your public URL — old links to
                      /u/{profile.handle} will stop working.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="bio">Bio</Label>
                    <span className="text-xs text-mist-dim">
                      {bio.length}/{MAX_BIO}
                    </span>
                  </div>
                  <textarea
                    id="bio"
                    value={bio}
                    maxLength={MAX_BIO}
                    rows={3}
                    placeholder="A line or two about you…"
                    onChange={(e) => setBio(e.target.value)}
                    className="glass w-full resize-none rounded-2xl px-4 py-3 text-[15px] text-ink placeholder:text-mist-dim outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-white/30"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="tag-input">Interests</Label>
                    <span className="text-xs text-mist-dim">
                      {tags.length}/{MAX_TAGS}
                    </span>
                  </div>
                  <div className="glass flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-white/30">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-white/10 px-2.5 py-1 text-xs text-mist"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove ${tag}`}
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                          className="cursor-pointer text-mist-dim transition-colors hover:text-ink"
                        >
                          <Xmark className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      id="tag-input"
                      value={tagDraft}
                      placeholder={tags.length ? "" : "music, film, cooking…"}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(tagDraft);
                        } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                          setTags((prev) => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => addTag(tagDraft)}
                      className="h-7 min-w-24 flex-1 bg-transparent text-[15px] text-ink placeholder:text-mist-dim outline-none"
                    />
                  </div>
                  <p className="text-xs text-mist-dim">
                    Press Enter to add. Used for matching you with people who share
                    your interests.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-5">
                  <div>
                    <Label className="mb-0.5 block text-ink">Public profile</Label>
                    <p className="text-xs text-mist-dim">
                      Let anyone view your profile page and find you in discovery.
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Public URL</Label>
                  <div className="glass flex items-center gap-2 rounded-2xl py-2 pl-4 pr-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-mist">
                      {profileUrl}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy profile URL"
                      onClick={() => copyProfileUrl(profileUrl)}
                      className="cursor-pointer rounded-full p-2 text-mist transition-colors hover:bg-white/10 hover:text-ink"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <a
                      href={`/u/${profile.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open public profile"
                      className="rounded-full p-2 text-mist transition-colors hover:bg-white/10 hover:text-ink"
                    >
                      <OpenNewWindow className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                <Button className="w-full" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </GlassCard>

            {/* -------------------------------------------------- Email */}
            <GlassCard strong className="p-8">
              <SectionHeading>Email</SectionHeading>

              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-mist" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-ink">
                    {profile.emailIsPlaceholder ? "No email set" : profile.email}
                  </p>
                  <p className="text-xs text-mist-dim">
                    {profile.emailIsPlaceholder
                      ? "Add one to secure your account."
                      : profile.emailVerified
                        ? "Verified"
                        : "Not verified yet"}
                  </p>
                </div>
                {!profile.emailIsPlaceholder && profile.emailVerified ? (
                  <span className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 px-3 py-1 text-xs text-ink">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">
                    {profile.emailIsPlaceholder ? "Add email" : "Change email"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={emailDraft}
                      placeholder="you@example.com"
                      autoComplete="email"
                      onChange={(e) => setEmailDraft(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={saveEmail}
                      disabled={
                        emailSaving ||
                        !emailDraft.trim() ||
                        emailDraft.trim().toLowerCase() === profile.email
                      }
                    >
                      {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                  {!profile.emailIsPlaceholder ? (
                    <p className="text-xs text-mist-dim">
                      Changing your email means verifying it again.
                    </p>
                  ) : null}
                </div>

                {showEmailVerify ? (
                  <div className="glass flex flex-col gap-3 rounded-2xl p-4">
                    {otpStage === "idle" ? (
                      <>
                        <p className="text-sm text-mist">
                          Verify {profile.email} to confirm it&apos;s yours. We&apos;ll
                          email you a 6-digit code.
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="self-start"
                          onClick={sendCode}
                          disabled={otpBusy || cooldown > 0}
                        >
                          {otpBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendMail className="h-4 w-4" />
                          )}
                          {cooldown > 0 ? `Resend in ${cooldown}s` : "Send code"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-mist">
                          Enter the 6-digit code we sent to {profile.email}.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={otpCode}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="000000"
                            className="tracking-[0.4em]"
                            onChange={(e) =>
                              setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") verifyCode();
                            }}
                          />
                          <Button
                            onClick={verifyCode}
                            disabled={otpBusy || otpCode.length !== 6}
                          >
                            {otpBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Verify"
                            )}
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={sendCode}
                          disabled={otpBusy || cooldown > 0}
                          className="self-start cursor-pointer text-xs text-mist-dim underline underline-offset-4 transition-colors hover:text-mist disabled:cursor-not-allowed disabled:no-underline"
                        >
                          {cooldown > 0
                            ? `Resend code in ${cooldown}s`
                            : "Resend code"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </GlassCard>

            {/* -------------------------------------------- Connections */}
            <GlassCard strong className="p-8">
              <SectionHeading>Connections</SectionHeading>
              <div className="flex flex-col gap-4">
                {(
                  [
                    {
                      key: "discord" as const,
                      label: "Discord",
                      Icon: Discord,
                      linked: profile.discordLinked,
                    },
                    {
                      key: "github" as const,
                      label: "GitHub",
                      Icon: Github,
                      linked: profile.githubLinked,
                    },
                  ]
                ).map(({ key, label, Icon, linked }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-mist" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-ink">{label}</p>
                      <p className="text-xs text-mist-dim">
                        {linked ? "Connected" : "Not connected"}
                      </p>
                    </div>
                    {linked ? (
                      <span className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 px-3 py-1 text-xs text-ink">
                        <Check className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => signIn(key, { redirectTo: "/profile" })}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-white/5 pt-4 text-xs text-mist-dim">
                Connecting matches accounts by email — make sure the email on your{" "}
                Discord or GitHub account is the same as the one on your Glimpse
                account, or you&apos;ll be signed in to a separate account.
              </p>
            </GlassCard>

            {/* ----------------------------------------------- Sign out */}
            <Button variant="secondary" className="w-full" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
