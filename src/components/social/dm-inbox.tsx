"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ChatBubbleEmpty, MediaImage } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DmOverlay } from "./dm-overlay";
import { timeAgo, type DmThread } from "./social-types";

type DmInboxProps = {
  /** Show only the first N threads (home preview). */
  limit?: number;
  /** Compact preview styling for embedding on the home page. */
  compact?: boolean;
  /** Open threads in a right-side overlay sheet instead of navigating. */
  overlay?: boolean;
  className?: string;
};

export function DmInbox({ limit, compact, overlay, className }: DmInboxProps) {
  const { data: session } = useSession();
  const [threads, setThreads] = useState<DmThread[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dms")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setThreads(Array.isArray(data.threads) ? data.threads : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setThreads([]);
        setFailed(true);
        // Only toast on the full page — the home preview fails quietly.
        if (!compact && !(err instanceof Error && err.message === "404")) {
          toast.error("Couldn't load your messages.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [compact]);

  const myId = session?.user?.id;
  const shown = limit && threads ? threads.slice(0, limit) : threads;

  if (threads === null) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {Array.from({ length: limit ?? 4 }).map((_, i) => (
          <div key={i} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/8" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-full bg-white/8" />
              <div className="h-3 w-40 animate-pulse rounded-full bg-white/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (shown && shown.length === 0) {
    return (
      <div
        className={cn(
          "glass flex flex-col items-center gap-2 rounded-2xl px-6 text-center",
          compact ? "py-6" : "py-12",
          className
        )}
      >
        <ChatBubbleEmpty className="h-6 w-6 text-mist-dim" />
        <p className="text-sm text-mist">
          {failed ? "Messages are unavailable right now." : "No conversations yet."}
        </p>
        {!failed ? (
          <p className="text-xs text-mist-dim">
            Find someone on{" "}
            <Link href="/discover" className="text-mist underline-offset-4 hover:underline">
              Discover
            </Link>{" "}
            and say hi.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {shown?.map((thread) => {
        const last = thread.lastMessage;
        const mine = last && myId && last.senderId === myId;
        const rowClass =
          "glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/10";
        const row = (
          <>
            <Avatar
              src={thread.otherUser.avatarWebpBase64}
              name={thread.otherUser.name}
              size={compact ? 36 : 44}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{thread.otherUser.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-mist-dim">
                {mine ? <span className="shrink-0">You:</span> : null}
                {last ? (
                  last.body ? (
                    <span className="truncate">{last.body}</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <MediaImage className="h-3 w-3" /> Photo
                    </span>
                  )
                ) : (
                  <span className="italic">Say hello</span>
                )}
              </p>
            </div>
            {last ? (
              <span className="shrink-0 text-xs text-mist-dim">{timeAgo(last.createdAt)}</span>
            ) : null}
          </>
        );
        return overlay ? (
          <button
            key={thread.threadId}
            onClick={() => setOpenThreadId(thread.threadId)}
            className={cn(rowClass, "cursor-pointer text-left")}
          >
            {row}
          </button>
        ) : (
          <Link key={thread.threadId} href={`/dms/${thread.threadId}`} className={rowClass}>
            {row}
          </Link>
        );
      })}
      {overlay ? (
        <DmOverlay threadId={openThreadId} onClose={() => setOpenThreadId(null)} />
      ) : null}
    </div>
  );
}
