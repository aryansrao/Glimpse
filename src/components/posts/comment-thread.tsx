"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  NavArrowDown,
  NavArrowRight,
  RefreshDouble as Loader2,
  SendDiagonal,
} from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/components/social/social-types";
import { cn } from "@/lib/utils";
import { toPostComment, toPostComments, type PostComment } from "./post-types";

/** Depth after which the left indent line stops nesting visually. */
const MAX_INDENT_DEPTH = 5;
/** Children of comments at this depth or deeper start collapsed. */
const AUTO_COLLAPSE_DEPTH = 2;

/* ------------------------------------------------------------------ */
/* Tree building                                                      */
/* ------------------------------------------------------------------ */

type CommentNodeData = {
  comment: PostComment;
  children: CommentNodeData[];
};

/** Flat list → sorted tree. Orphans (missing parent) surface as roots. */
function buildCommentTree(comments: PostComment[]): CommentNodeData[] {
  const nodes = new Map<string, CommentNodeData>();
  for (const c of comments) nodes.set(c.id, { comment: c, children: [] });

  const roots: CommentNodeData[] = [];
  for (const node of nodes.values()) {
    const parent = node.comment.parentId ? nodes.get(node.comment.parentId) : undefined;
    if (parent && parent.comment.id !== node.comment.id) parent.children.push(node);
    else roots.push(node);
  }

  const sortLevel = (list: CommentNodeData[]) => {
    list.sort(
      (a, b) =>
        b.comment.score - a.comment.score ||
        a.comment.createdAt.localeCompare(b.comment.createdAt)
    );
    for (const n of list) sortLevel(n.children);
  };
  sortLevel(roots);
  return roots;
}

/* ------------------------------------------------------------------ */
/* Composer (top-level + inline replies)                              */
/* ------------------------------------------------------------------ */

function CommentComposer({
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
  className,
}: {
  placeholder: string;
  autoFocus?: boolean;
  /** Resolves true on success (the composer clears itself). */
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onSubmit(body);
    setSending(false);
    if (ok) setDraft("");
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex items-center gap-2", className)}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        maxLength={500}
        autoFocus={autoFocus}
        className="glass h-9 min-w-0 flex-1 rounded-full px-4 text-sm text-ink outline-none placeholder:text-mist-dim focus-visible:ring-1 focus-visible:ring-white/30"
        aria-label={placeholder}
      />
      <button
        type="submit"
        disabled={sending || !draft.trim()}
        className="glass flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:cursor-default disabled:opacity-40"
        aria-label="Post comment"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SendDiagonal className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Vote cluster                                                       */
/* ------------------------------------------------------------------ */

function VoteCluster({
  comment,
  onVote,
}: {
  comment: PostComment;
  onVote: (commentId: string, value: 1 | -1 | 0) => void;
}) {
  const up = comment.myVote === 1;
  const down = comment.myVote === -1;

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onVote(comment.id, up ? 0 : 1)}
        aria-pressed={up}
        aria-label={up ? "Remove upvote" : "Upvote"}
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all active:scale-[0.9]",
          up ? "bg-white/15 text-ink" : "text-mist-dim hover:bg-white/5 hover:text-ink"
        )}
      >
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={up ? 2.5 : undefined} />
      </button>
      <span
        className={cn(
          "min-w-5 text-center text-xs font-medium tabular-nums",
          up || down ? "text-ink" : "text-mist"
        )}
        aria-label={`Score ${comment.score}`}
      >
        {comment.score}
      </span>
      <button
        onClick={() => onVote(comment.id, down ? 0 : -1)}
        aria-pressed={down}
        aria-label={down ? "Remove downvote" : "Downvote"}
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all active:scale-[0.9]",
          down ? "bg-white/15 text-ink" : "text-mist-dim hover:bg-white/5 hover:text-ink"
        )}
      >
        <ArrowDown className="h-3.5 w-3.5" strokeWidth={down ? 2.5 : undefined} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comment node (recursive)                                           */
/* ------------------------------------------------------------------ */

function CommentNode({
  node,
  depth,
  onVote,
  onReply,
}: {
  node: CommentNodeData;
  depth: number;
  onVote: (commentId: string, value: 1 | -1 | 0) => void;
  /** Resolves true on success. */
  onReply: (body: string, parentId: string) => Promise<boolean>;
}) {
  const c = node.comment;
  const [replyOpen, setReplyOpen] = useState(false);
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const expanded = expandedOverride ?? depth < AUTO_COLLAPSE_DEPTH;
  const replyCount = node.children.length;

  return (
    <div className="flex items-start gap-2.5">
      <Avatar src={c.user.avatarWebpBase64} name={c.user.name} size={depth === 0 ? 28 : 24} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          {c.user.handle ? (
            <Link
              href={`/u/${c.user.handle}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              {c.user.name}
            </Link>
          ) : (
            <span className="font-medium text-ink">{c.user.name}</span>
          )}{" "}
          <span className="text-mist-dim">{timeAgo(c.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-mist">
          {c.body}
        </p>

        {/* Action row */}
        <div className="mt-1 flex items-center gap-1">
          <VoteCluster comment={c} onVote={onVote} />
          <button
            onClick={() => setReplyOpen((v) => !v)}
            aria-expanded={replyOpen}
            className={cn(
              "cursor-pointer rounded-full px-2 py-1 text-xs font-medium transition-colors",
              replyOpen ? "text-ink" : "text-mist-dim hover:bg-white/5 hover:text-ink"
            )}
          >
            Reply
          </button>
          {replyCount > 0 ? (
            <button
              onClick={() => setExpandedOverride(!expanded)}
              aria-expanded={expanded}
              className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-mist-dim transition-colors hover:bg-white/5 hover:text-ink"
            >
              {expanded ? (
                <NavArrowDown className="h-3 w-3" />
              ) : (
                <NavArrowRight className="h-3 w-3" />
              )}
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          ) : null}
        </div>

        {replyOpen ? (
          <CommentComposer
            placeholder={`Reply to ${c.user.name}...`}
            autoFocus
            className="mt-2"
            onCancel={() => setReplyOpen(false)}
            onSubmit={async (body) => {
              const ok = await onReply(body, c.id);
              if (ok) {
                setReplyOpen(false);
                setExpandedOverride(true);
              }
              return ok;
            }}
          />
        ) : null}

        {/* Children — classic Reddit indent line, capped visually */}
        {replyCount > 0 && expanded ? (
          <div
            className={cn(
              "mt-3 flex flex-col gap-3",
              depth < MAX_INDENT_DEPTH && "border-l border-white/10 pl-3"
            )}
          >
            {node.children.map((child) => (
              <CommentNode
                key={child.comment.id}
                node={child}
                depth={depth + 1}
                onVote={onVote}
                onReply={onReply}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                             */
/* ------------------------------------------------------------------ */

export function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  /** Called with +1 per new comment so the card can bump its counter. */
  onCountChange: (delta: number) => void;
}) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const voteBusy = useRef(new Set<string>());

  const loadPage = useCallback(
    async (cursor: string | null) => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return {
        page: toPostComments(data.comments),
        // nextCursor is epoch ms (a number); tolerate a string just in case.
        nextCursor:
          typeof data.nextCursor === "number" || typeof data.nextCursor === "string"
            ? String(data.nextCursor)
            : null,
      };
    },
    [postId]
  );

  useEffect(() => {
    let cancelled = false;
    loadPage(null)
      .then(({ page, nextCursor }) => {
        if (cancelled) return;
        setComments(page);
        setNextCursor(nextCursor);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  async function loadMore() {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const { page, nextCursor: cursor } = await loadPage(nextCursor);
      setComments((prev) => {
        const seen = new Set((prev ?? []).map((c) => c.id));
        return [...(prev ?? []), ...page.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cursor);
    } catch {
      toast.error("Couldn't load more comments.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function vote(commentId: string, value: 1 | -1 | 0) {
    if (!session?.user) {
      toast.error("Sign in to vote.");
      return;
    }
    if (voteBusy.current.has(commentId)) return;
    const target = comments?.find((c) => c.id === commentId);
    if (!target) return;

    const prevScore = target.score;
    const prevVote = target.myVote;
    const rollback = () =>
      setComments((prev) =>
        (prev ?? []).map((c) =>
          c.id === commentId ? { ...c, score: prevScore, myVote: prevVote } : c
        )
      );

    // Optimistic update.
    setComments((prev) =>
      (prev ?? []).map((c) =>
        c.id === commentId ? { ...c, score: c.score - c.myVote + value, myVote: value } : c
      )
    );

    voteBusy.current.add(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.status === 401) {
        rollback();
        toast.error("Sign in to vote.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      // Reconcile with the server's numbers when present.
      setComments((prev) =>
        (prev ?? []).map((c) =>
          c.id === commentId
            ? {
                ...c,
                score: typeof data.score === "number" ? data.score : c.score,
                myVote:
                  data.myVote === 1 || data.myVote === -1 || data.myVote === 0
                    ? data.myVote
                    : c.myVote,
              }
            : c
        )
      );
    } catch {
      rollback();
      toast.error("Couldn't register that vote.");
    } finally {
      voteBusy.current.delete(commentId);
    }
  }

  async function submitComment(body: string, parentId: string | null): Promise<boolean> {
    if (!session?.user) {
      toast.error("Sign in to comment.");
      return false;
    }
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentId ? { body, parentId } : { body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't comment right now.");
        return false;
      }
      const raw = data && typeof data.id === "string" ? data : data.comment;
      const parsed = toPostComment(raw);
      // Reply depth caps at 6 and the server may reparent deep replies to the
      // level-6 ancestor — always trust the response's parentId when the field
      // is present; only fall back to the one we sent if the server omitted it.
      const serverHasParentId =
        typeof raw === "object" && raw !== null && "parentId" in (raw as Record<string, unknown>);
      const comment: PostComment = parsed
        ? { ...parsed, parentId: serverHasParentId ? parsed.parentId : parentId }
        : {
            id: `local-${Date.now()}`,
            parentId,
            body,
            score: 0,
            myVote: 0,
            createdAt: new Date().toISOString(),
            user: {
              id: session.user.id ?? "",
              handle: session.user.handle ?? null,
              name: session.user.name ?? "You",
              avatarWebpBase64: session.user.avatarWebpBase64 ?? null,
            },
          };
      setComments((prev) => [...(prev ?? []), comment]);
      onCountChange(1);
      return true;
    } catch {
      toast.error("Couldn't comment right now.");
      return false;
    }
  }

  const tree = comments ? buildCommentTree(comments) : [];

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      {comments === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-mist-dim">No comments yet. Say something.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {tree.map((node) => (
            <CommentNode
              key={node.comment.id}
              node={node}
              depth={0}
              onVote={vote}
              onReply={(body, parentId) => submitComment(body, parentId)}
            />
          ))}
        </div>
      )}

      {nextCursor ? (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Load more comments
        </button>
      ) : null}

      <CommentComposer
        placeholder="Add a comment..."
        className="mt-3"
        onSubmit={(body) => submitComment(body, null)}
      />
    </div>
  );
}
