export type SocialUser = {
  id: string;
  handle: string | null;
  name: string;
  avatarWebpBase64: string | null;
  isPublic?: boolean;
};

export type Story = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  createdAt: string;
  seen: boolean;
};

export type StoryGroup = {
  user: SocialUser;
  stories: Story[];
  allSeen: boolean;
};

export type DmThread = {
  threadId: string;
  otherUserId: string;
  otherUser: SocialUser;
  state: "accepted" | "request";
  pendingApproval?: boolean;
  requestForMe?: boolean;
  lastMessage: {
    body: string | null;
    mediaType: string | null;
    senderId: string;
    createdAt: string;
  } | null;
};

export type ReplyPreview = {
  id: string;
  body: string | null;
  senderId: string;
  mediaType: string | null;
};

export type DmMessage = {
  id: string;
  senderId: string;
  body: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  replyToId?: string | null;
  replyPreview?: ReplyPreview | null;
  reactions?: Array<{ emoji: string; userId: string }>;
  createdAt: string;
  /** Client-only flag for optimistic sends. */
  pending?: boolean;
};

/** Compact relative timestamp: "now", "4m", "2h", "3d", then a short date. */
export function timeAgo(iso: string | Date): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const ms = Date.now() - then.getTime();
  if (Number.isNaN(ms)) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Clock time for message bubbles, e.g. "4:03 PM". */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
