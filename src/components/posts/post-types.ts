export type PostUser = {
  id: string;
  handle: string | null;
  name: string;
  avatarWebpBase64: string | null;
};

export type PostMediaType = "image" | "video" | "pdf";

export type PostMediaItem = {
  url: string;
  type: PostMediaType;
  fileName: string | null;
};

export type PostView = {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  /** Ordered media attachments (up to 4). Falls back to legacy mediaUrl/mediaType. */
  media: PostMediaItem[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  liked: boolean;
  user: PostUser;
};

export type PostComment = {
  id: string;
  parentId: string | null;
  body: string;
  score: number;
  myVote: 1 | 0 | -1;
  createdAt: string;
  user: PostUser;
};

function toPostUser(raw: unknown): PostUser {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof u.id === "string" ? u.id : "",
    handle: typeof u.handle === "string" ? u.handle : null,
    name: typeof u.name === "string" ? u.name : "Someone",
    avatarWebpBase64: typeof u.avatarWebpBase64 === "string" ? u.avatarWebpBase64 : null,
  };
}

/** Defensive media item normalizer — unknown types render as images (legacy behavior). */
export function toPostMediaItem(raw: unknown): PostMediaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.url !== "string" || m.url.length === 0) return null;
  return {
    url: m.url,
    type: m.type === "video" || m.type === "pdf" ? m.type : "image",
    fileName: typeof m.fileName === "string" ? m.fileName : null,
  };
}

/** Defensive normalizer — the posts API may still be under construction. */
export function toPostView(raw: unknown): PostView | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string") return null;

  const mediaUrl = typeof p.mediaUrl === "string" ? p.mediaUrl : null;
  const mediaType = typeof p.mediaType === "string" ? p.mediaType : null;

  let media: PostMediaItem[] = Array.isArray(p.media)
    ? p.media
        .map(toPostMediaItem)
        .filter((m): m is PostMediaItem => m !== null)
        .slice(0, 4)
    : [];
  if (media.length === 0 && mediaUrl) {
    media = [
      {
        url: mediaUrl,
        type: mediaType === "video" || mediaType === "pdf" ? mediaType : "image",
        fileName: null,
      },
    ];
  }

  return {
    id: p.id,
    body: typeof p.body === "string" ? p.body : null,
    mediaUrl,
    mediaType,
    media,
    tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [],
    likeCount: typeof p.likeCount === "number" ? p.likeCount : 0,
    commentCount: typeof p.commentCount === "number" ? p.commentCount : 0,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
    liked: Boolean(p.liked),
    user: toPostUser(p.user),
  };
}

export function toPostViews(raw: unknown): PostView[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toPostView).filter((p): p is PostView => p !== null);
}

/** Defensive comment normalizer — vote fields may be missing while the API lands. */
export function toPostComment(raw: unknown): PostComment | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.body !== "string") return null;
  return {
    id: c.id,
    parentId: typeof c.parentId === "string" ? c.parentId : null,
    body: c.body,
    score: typeof c.score === "number" ? c.score : 0,
    myVote: c.myVote === 1 || c.myVote === -1 ? c.myVote : 0,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date().toISOString(),
    user: toPostUser(c.user),
  };
}

export function toPostComments(raw: unknown): PostComment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toPostComment).filter((c): c is PostComment => c !== null);
}

/** Pull #hashtags out of a post body, Instagram-style. */
export function extractPostTags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_-]{2,24})/gu) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))].slice(0, 8);
}
