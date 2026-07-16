"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "./follow-button";
import { cn } from "@/lib/utils";

type UserChipProps = {
  user: {
    id?: string;
    handle: string | null;
    name: string;
    avatarWebpBase64: string | null;
  };
  subtitle?: string;
  withFollow?: boolean;
  className?: string;
};

/** Compact glass row: avatar, name, @handle, optional follow button. */
export function UserChip({ user, subtitle, withFollow, className }: UserChipProps) {
  const inner = (
    <>
      <Avatar src={user.avatarWebpBase64} name={user.name} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-mist-dim">
          {subtitle ?? (user.handle ? `@${user.handle}` : "on Glimpse")}
        </p>
      </div>
      {withFollow && user.id ? <FollowButton userId={user.id} size="xs" /> : null}
    </>
  );

  const chipClass = cn(
    "glass flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
    user.handle ? "hover:bg-white/10" : "",
    className
  );

  if (user.handle) {
    return (
      <Link href={`/u/${user.handle}`} className={chipClass}>
        {inner}
      </Link>
    );
  }
  return <div className={chipClass}>{inner}</div>;
}
