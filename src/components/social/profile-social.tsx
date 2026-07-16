"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "./follow-button";
import { MessageButton } from "./message-button";
import type { SocialUser } from "./social-types";

type ListType = "followers" | "following";

/**
 * Social strip for the public profile page: follower/following counts
 * (tappable lists) plus Follow + Message actions for signed-in viewers.
 */
export function ProfileSocial({
  userId,
  isOwn,
  signedIn,
}: {
  userId: string;
  isOwn: boolean;
  signedIn: boolean;
}) {
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [listOpen, setListOpen] = useState<ListType | null>(null);
  const [listUsers, setListUsers] = useState<SocialUser[] | null>(null);

  const loadCounts = useCallback(() => {
    fetch(`/api/follows/counts?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.followers === "number" && typeof data.following === "number") {
          setCounts({ followers: data.followers, following: data.following });
        }
      })
      .catch(() => {
        // Follows backend not live yet — counts stay hidden.
      });
  }, [userId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!listOpen) return;
    let cancelled = false;
    fetch(`/api/follows/list?type=${listOpen}&userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setListUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (!cancelled) setListUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listOpen, userId]);

  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      {counts ? (
        <div className="flex items-center gap-5 text-sm">
          <button
            onClick={() => {
              setListOpen("followers");
              setListUsers(null);
            }}
            className="cursor-pointer text-mist transition-colors hover:text-ink"
          >
            <span className="font-medium text-ink">{counts.followers}</span> follower
            {counts.followers === 1 ? "" : "s"}
          </button>
          <span className="h-3 w-px bg-white/15" aria-hidden />
          <button
            onClick={() => {
              setListOpen("following");
              setListUsers(null);
            }}
            className="cursor-pointer text-mist transition-colors hover:text-ink"
          >
            <span className="font-medium text-ink">{counts.following}</span> following
          </button>
        </div>
      ) : null}

      {signedIn && !isOwn ? (
        <div className="flex items-center gap-2.5">
          <FollowButton
            userId={userId}
            onChanged={(following) => {
              setCounts((prev) =>
                prev
                  ? { ...prev, followers: Math.max(0, prev.followers + (following ? 1 : -1)) }
                  : prev
              );
            }}
          />
          <MessageButton userId={userId} />
        </div>
      ) : null}

      <Dialog open={listOpen !== null} onOpenChange={(o) => !o && setListOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listOpen === "following" ? "Following" : "Followers"}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {listUsers === null ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-white/8" />
                  <div className="h-3 w-28 animate-pulse rounded-full bg-white/8" />
                </div>
              ))
            ) : listUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-mist-dim">No one here yet.</p>
            ) : (
              listUsers.map((u) =>
                u.handle ? (
                  <Link
                    key={u.id}
                    href={`/u/${u.handle}`}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/5"
                    onClick={() => setListOpen(null)}
                  >
                    <Avatar src={u.avatarWebpBase64} name={u.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                      <p className="truncate text-xs text-mist-dim">@{u.handle}</p>
                    </div>
                  </Link>
                ) : (
                  <div key={u.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                    <Avatar src={u.avatarWebpBase64} name={u.name} size={36} />
                    <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                  </div>
                )
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
