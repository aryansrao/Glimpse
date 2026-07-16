"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatBubble, Group, LogOut, Search, User as UserRound } from "iconoir-react";

export function Navbar() {
  const { data: session, status } = useSession();
  const [guest, setGuest] = useState<{ name: string; hue: number } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setGuest({ name: d.name, hue: d.hue }))
        .catch(() => {});
    }
  }, [status]);

  return (
    <header className="relative z-20 flex items-center justify-between gap-2 px-4 py-5 sm:px-10 sm:py-6">
      <Link href="/" className="flex shrink-0 items-center">
        <span className="font-logo text-xl tracking-tight text-ink">glimpse</span>
      </Link>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <Link
          href="/search"
          title="Search"
          className="flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-ink sm:px-3"
        >
          <Search className="h-[18px] w-[18px]" />
          <span className="hidden md:inline">Search</span>
        </Link>
        <Link
          href="/rooms"
          title="Rooms"
          className="flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-ink sm:px-3"
        >
          <Group className="h-[18px] w-[18px]" />
          <span className="hidden md:inline">Rooms</span>
        </Link>

        {status === "authenticated" && session?.user ? (
          <>
            <Link
              href="/dms"
              title="Messages"
              className="flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-ink sm:px-3"
            >
              <ChatBubble className="h-[18px] w-[18px]" />
              <span className="hidden md:inline">Messages</span>
            </Link>
            <Link
              href="/profile"
              className="glass flex items-center gap-2.5 rounded-full p-1 transition-colors hover:bg-white/10 sm:py-1 sm:pl-1 sm:pr-4"
            >
              <Avatar
                src={session.user.avatarWebpBase64}
                name={session.user.name ?? "Member"}
                size={32}
              />
              <span className="hidden max-w-[12ch] truncate text-sm font-medium text-ink sm:inline">
                {session.user.name}
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : status === "unauthenticated" ? (
          <>
            {guest ? (
              <span className="hidden items-center gap-2 rounded-full glass px-4 py-2 text-sm text-mist md:flex">
                <span className="h-2 w-2 rounded-full bg-white/60" />
                {guest.name}
              </span>
            ) : null}
            <Button variant="secondary" size="sm" asChild>
              <Link href="/sign-in">
                <UserRound className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
