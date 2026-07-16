"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, UserPlus } from "iconoir-react";
import { cn } from "@/lib/utils";

type FollowButtonProps = {
  userId: string;
  size?: "xs" | "sm";
  className?: string;
  /** Called after a successful server-confirmed change. */
  onChanged?: (following: boolean) => void;
};

/**
 * Optimistic follow toggle. States: Follow → Following, and "Friends" when
 * the follow is mutual (per GET /api/follows/status).
 */
export function FollowButton({ userId, size = "sm", className, onChanged }: FollowButtonProps) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followedBy, setFollowedBy] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/follows/status?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setFollowing(Boolean(data.following));
        setFollowedBy(Boolean(data.followedBy));
      })
      .catch(() => {
        // Route may not exist yet or viewer is signed out — default quietly.
        if (!cancelled) setFollowing((prev) => prev ?? false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle(e: React.MouseEvent) {
    // Cards often wrap this button in a Link.
    e.preventDefault();
    e.stopPropagation();
    if (busy || following === null) return;

    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/follows/${encodeURIComponent(userId)}`, {
        method: next ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : undefined);
      }
      if (mounted.current && typeof data.following === "boolean") {
        setFollowing(data.following);
      }
      onChanged?.(next);
    } catch (err) {
      if (mounted.current) setFollowing(!next);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : next
            ? "Couldn't follow right now."
            : "Couldn't unfollow right now."
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const isFriends = Boolean(following) && followedBy;
  const label =
    following === null ? "Follow" : isFriends ? "Friends" : following ? "Following" : "Follow";

  return (
    <button
      onClick={toggle}
      disabled={following === null || busy}
      aria-pressed={Boolean(following)}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full font-medium transition-all duration-200 active:scale-[0.97] disabled:cursor-default disabled:opacity-60",
        size === "xs" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
        following
          ? "glass text-mist hover:bg-white/10 hover:text-ink"
          : "bg-white/90 text-void hover:bg-white",
        className
      )}
    >
      {following === null ? null : following ? (
        <Check className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ) : (
        <UserPlus className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {label}
    </button>
  );
}
