"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshDouble as Loader2, MediaImage } from "iconoir-react";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { GlassCard } from "@/components/glass/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fileToAvatarWebpBase64 } from "@/lib/avatar-image";

/** Pull #hashtags out of the description, Instagram-style. */
function extractTags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_-]{2,24})/gu) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))].slice(0, 8);
}

export default function NewRoomPage() {
  const router = useRouter();
  const { status } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const tags = extractTags(description);

  async function handleIconFile(file: File) {
    try {
      setIcon(await fileToAvatarWebpBase64(file));
    } catch {
      toast.error("Couldn't process that image.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Give your room a name (2+ characters).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/chatrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          icon: icon ?? undefined,
          description: description || undefined,
          tags,
          visibility: isPrivate ? "private" : "public",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create that room.");
        return;
      }
      toast.success("Room created.");
      router.push(`/rooms/${data.slug}`);
    } finally {
      setLoading(false);
    }
  }

  const signedOut = status === "unauthenticated";

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <GlimpseOrb className="-z-10" />
        <div className="relative w-full max-w-md">
          <GlassCard
            strong
            className={`w-full p-8 ${signedOut ? "pointer-events-none select-none blur-md" : ""}`}
            aria-hidden={signedOut}
          >
            <h1 className="mb-6 font-display text-2xl font-medium">New room</h1>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIconFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="glass flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-mist-dim transition hover:text-ink"
                  aria-label="Upload room icon"
                >
                  {icon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MediaImage className="h-6 w-6" />
                  )}
                </button>
                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Room name"
                    maxLength={60}
                    aria-label="Room name"
                  />
                  <p className="mt-1.5 text-xs text-mist-dim">Tap the square to add an icon.</p>
                </div>
              </div>

              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your room... add #tags anywhere, like #music #chill"
                  maxLength={300}
                  rows={4}
                  className="glass w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink outline-none placeholder:text-mist-dim focus-visible:ring-1 focus-visible:ring-white/30"
                  aria-label="Description"
                />
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="glass rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs text-mist"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Private room</p>
                  <p className="text-xs text-mist-dim">Invite-only, hidden from the directory.</p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              <Button type="submit" className="w-full" disabled={loading || signedOut}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create room
              </Button>
            </form>
          </GlassCard>

          {signedOut && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-xs text-sm text-mist">
                Rooms are for members. Sign in to create one and start inviting people.
              </p>
              <Button asChild>
                <Link href="/sign-in">Sign in to continue</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
