"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ChatBubble,
  Group as Users,
  Key as KeyRound,
  MediaImage,
  Microphone as Mic,
  Phone,
  Shuffle,
  VideoCamera as Video,
} from "iconoir-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { RoomIcon } from "@/components/rooms/room-icon";
import { StoriesRail } from "@/components/social/stories-rail";
import { DmInbox } from "@/components/social/dm-inbox";
import { HomeFeed } from "@/components/posts/post-feed";
import { UserChip } from "@/components/social/user-chip";
import { timeAgo } from "@/components/social/social-types";
import { CreateRoomDialog } from "./create-room-dialog";
import { JoinRoomDialog } from "./join-room-dialog";
import type { Mode } from "@/hooks/use-call-token";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm uppercase tracking-[0.18em] text-mist-dim">{title}</h2>
      {href ? (
        <Link href={href} className="text-xs text-mist transition-colors hover:text-ink">
          {linkLabel ?? "See all"} →
        </Link>
      ) : null}
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="glass inline-flex items-center gap-1 rounded-full p-1">
      <button
        onClick={() => setMode("video")}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
          mode === "video" ? "bg-white/12 text-ink" : "text-mist hover:text-ink"
        )}
      >
        <Video className="h-4 w-4" /> Video
      </button>
      <button
        onClick={() => setMode("audio")}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
          mode === "audio" ? "bg-white/12 text-ink" : "text-mist hover:text-ink"
        )}
      >
        <Mic className="h-4 w-4" /> Audio
      </button>
    </div>
  );
}

/** One-row compact action bar: primary Random + Create/Join pills. */
function ActionBar({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <>
      <div className="glass-strong flex flex-wrap items-center gap-2 rounded-[var(--radius-glass)] p-2.5 sm:flex-nowrap">
        <Button
          variant="secondary"
          onClick={() => router.push(`/chat/random?mode=${mode}`)}
          className="h-10 flex-1 basis-full !bg-white/14 ring-1 ring-white/25 hover:!bg-white/20 sm:basis-auto"
        >
          <Shuffle className="h-4 w-4" />
          Random glimpse
        </Button>
        <Button
          variant="secondary"
          onClick={() => setCreateOpen(true)}
          className="h-10 flex-1"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Create room</span>
          <span className="sm:hidden">Create</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setJoinOpen(true)}
          className="h-10 flex-1"
        >
          <KeyRound className="h-4 w-4" />
          <span className="hidden sm:inline">Join room</span>
          <span className="sm:hidden">Join</span>
        </Button>
        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/6 p-1">
          <button
            onClick={() => setMode("video")}
            aria-label="Video calls"
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-full p-2 transition-all",
              mode === "video" ? "bg-white/14 text-ink" : "text-mist hover:text-ink"
            )}
          >
            <Video className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMode("audio")}
            aria-label="Audio calls"
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-full p-2 transition-all",
              mode === "audio" ? "bg-white/14 text-ink" : "text-mist hover:text-ink"
            )}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} mode={mode} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </>
  );
}

/** The three call actions as glass cards — used on the signed-out landing. */
function CallActions({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const cards: Array<{
    title: string;
    caption: string;
    icon: React.ReactNode;
    strong?: boolean;
    action: () => void;
  }> = [
    {
      title: "Random glimpse",
      caption: "Meet the next person looking too",
      icon: <Shuffle className="h-5 w-5" />,
      strong: true,
      action: () => router.push(`/chat/random?mode=${mode}`),
    },
    {
      title: "Create a room",
      caption: "A private code for your people",
      icon: <Users className="h-5 w-5" />,
      action: () => setCreateOpen(true),
    },
    {
      title: "Join a room",
      caption: "Have a code? Drop right in",
      icon: <KeyRound className="h-5 w-5" />,
      action: () => setJoinOpen(true),
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <GlassCard
            key={card.title}
            strong={card.strong}
            className="group flex cursor-pointer items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:bg-white/10"
            onClick={card.action}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && card.action()}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-ink",
                card.strong ? "bg-white/10" : "bg-white/8"
              )}
            >
              {card.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-[15px] font-medium text-ink">{card.title}</h3>
              <p className="truncate text-xs text-mist">{card.caption}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} mode={mode} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Feed sections                                                      */
/* ------------------------------------------------------------------ */

type RoomPreview = {
  slug: string;
  name: string;
  icon: string | null;
  topic: string | null;
  memberCount: number;
};

function RoomsPreview() {
  const [rooms, setRooms] = useState<RoomPreview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chatrooms")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setRooms(Array.isArray(data.rooms) ? data.rooms.slice(0, 4) : []);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <SectionHeader title="Popular rooms" href="/rooms" linkLabel="All rooms" />
      {rooms === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-16 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-8 text-center">
          <p className="text-sm text-mist">No public rooms yet.</p>
          <Link
            href="/rooms/new"
            className="text-xs text-mist-dim underline-offset-4 hover:underline"
          >
            Start the first one
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map((room) => (
            <Link
              key={room.slug}
              href={`/rooms/${room.slug}`}
              className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 text-lg">
                <RoomIcon icon={room.icon} name={room.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{room.name}</p>
                <p className="truncate text-xs text-mist-dim">
                  {room.topic ?? `${room.memberCount} member${room.memberCount === 1 ? "" : "s"}`}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-mist-dim">
                <Users className="h-3.5 w-3.5" />
                {room.memberCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

type SimilarPerson = {
  id?: string;
  handle: string;
  name: string;
  avatarWebpBase64: string | null;
  sharedTags?: string[];
};

function PeopleLikeYou() {
  const [people, setPeople] = useState<SimilarPerson[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/discover?similar=1")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setPeople(Array.isArray(data.results) ? data.results.slice(0, 4) : []);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <SectionHeader title="People like you" href="/discover?similar=1" linkLabel="More" />
      {people === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-[60px] animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-8 text-center">
          <p className="text-sm text-mist">No matches yet.</p>
          <p className="text-xs text-mist-dim">
            Add interests to your{" "}
            <Link href="/profile" className="underline-offset-4 hover:underline">
              profile
            </Link>{" "}
            so kindred people can surface here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {people.map((p) => (
            <UserChip
              key={p.handle}
              user={{
                id: p.id,
                handle: p.handle,
                name: p.name,
                avatarWebpBase64: p.avatarWebpBase64,
              }}
              subtitle={
                p.sharedTags?.length
                  ? `${p.sharedTags.length} shared interest${p.sharedTags.length === 1 ? "" : "s"}`
                  : undefined
              }
              withFollow
            />
          ))}
        </div>
      )}
    </section>
  );
}

type RecentCall = {
  user: { id: string; handle: string | null; name: string; avatarWebpBase64: string | null };
  mode: Mode;
  endedAt: string;
};

function RecentCalls() {
  const [calls, setCalls] = useState<RecentCall[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calls/recent")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.calls) ? data.calls : [];
        if (!cancelled) setCalls(list.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setCalls([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <SectionHeader title="Recent calls" />
      {calls === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass h-14 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-8 text-center">
          <Phone className="h-5 w-5 text-mist-dim" />
          <p className="text-sm text-mist">No calls yet.</p>
          <Link
            href="/chat/random"
            className="text-xs text-mist-dim underline-offset-4 hover:underline"
          >
            Take your first glimpse
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((call, i) => (
            <div
              key={`${call.user.id}-${call.endedAt}-${i}`}
              className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5"
            >
              <Avatar src={call.user.avatarWebpBase64} name={call.user.name} size={36} />
              <div className="min-w-0 flex-1">
                {call.user.handle ? (
                  <Link
                    href={`/u/${call.user.handle}`}
                    className="block truncate text-sm font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {call.user.name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-ink">{call.user.name}</p>
                )}
                <p className="flex items-center gap-1 text-xs text-mist-dim">
                  {call.mode === "audio" ? (
                    <Mic className="h-3 w-3" />
                  ) : (
                    <Video className="h-3 w-3" />
                  )}
                  {timeAgo(call.endedAt)} ago
                </p>
              </div>
              <Link
                href={`/chat/random?mode=${call.mode}`}
                className="glass shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink"
              >
                Again
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Signed-in home                                                     */
/* ------------------------------------------------------------------ */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SignedInHome({ name }: { name: string }) {
  const [mode, setMode] = useState<Mode>("video");
  const firstName = name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      {/* Everything actionable lives in this compact top block. */}
      <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
        <p className="pt-1 text-sm text-mist">
          {greeting()}, <span className="text-ink">{firstName}</span>.
        </p>
        <div className="mt-3">
          <ActionBar mode={mode} setMode={setMode} />
        </div>
        <StoriesRail className="mt-4" />
      </motion.div>

      {/* Feed starts right here. */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0">
          <HomeFeed />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <SectionHeader title="Messages" href="/dms" linkLabel="Inbox" />
            <DmInbox limit={3} compact />
          </section>
          <RecentCalls />
          <RoomsPreview />
          <PeopleLikeYou />
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signed-out landing                                                 */
/* ------------------------------------------------------------------ */

function SignedOutHome() {
  const [mode, setMode] = useState<Mode>("video");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 sm:px-6">
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mt-10 flex flex-col items-center text-center sm:mt-16"
      >
        <h1 className="font-display text-4xl font-medium tracking-tight sm:text-6xl">
          A <span className="text-gradient">glimpse</span> of someone new.
        </h1>
        <p className="mt-4 max-w-md text-balance text-mist">
          Talk face to face with a stranger, or bring your own people into a private
          room. Nothing is recorded — video never touches a server.
        </p>
      </motion.div>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        className="mt-8 w-full"
      >
        <div className="mb-5 flex justify-center">
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
        <CallActions mode={mode} />
      </motion.div>

      {/* Teaser: what sign-in unlocks */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="mt-12 w-full"
      >
        <GlassCard className="relative overflow-hidden p-7 sm:p-9">
          {/* Ghosted story rings */}
          <div aria-hidden className="pointer-events-none flex gap-4 overflow-hidden opacity-40 blur-[2px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-14 w-14 shrink-0 rounded-full border-2 bg-white/5",
                  i % 3 === 0 ? "border-white/60" : "border-white/15"
                )}
              />
            ))}
          </div>
          <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-medium text-ink">
                There&apos;s more behind the glass.
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-mist">
                <li className="flex items-center gap-2">
                  <MediaImage className="h-4 w-4 text-mist-dim" />
                  Stories that fade in 24 hours
                </li>
                <li className="flex items-center gap-2">
                  <ChatBubble className="h-4 w-4 text-mist-dim" />
                  Direct messages with the people you meet
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-mist-dim" />
                  Follows, friends, and rooms that persist
                </li>
              </ul>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/sign-in">Sign in to unlock</Link>
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                              */
/* ------------------------------------------------------------------ */

export function HomeView() {
  const { data: session, status } = useSession();

  return (
    <main className="relative flex flex-1 flex-col">
      <GlimpseOrb className="-z-10" />
      {status === "loading" ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
          <div className="glass h-9 w-56 animate-pulse rounded-full" />
          <div className="mt-8 flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-white/8" />
            ))}
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass h-20 animate-pulse rounded-[var(--radius-glass)]" />
            ))}
          </div>
        </div>
      ) : status === "authenticated" && session?.user ? (
        <SignedInHome name={session.user.name ?? "there"} />
      ) : (
        <SignedOutHome />
      )}
    </main>
  );
}
