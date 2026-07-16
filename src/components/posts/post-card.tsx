"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ChatBubble,
  Copy,
  Heart,
  HeartSolid,
  Page,
  RefreshDouble as Loader2,
  Trash,
} from "iconoir-react";
import { GlassCard } from "@/components/glass/glass-card";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/components/social/follow-button";
import { timeAgo } from "@/components/social/social-types";
import { cn } from "@/lib/utils";
import { CommentThread } from "./comment-thread";
import { PostBody } from "./post-body";
import type { PostMediaItem, PostView } from "./post-types";

/* ------------------------------------------------------------------ */
/* Media gallery                                                      */
/* ------------------------------------------------------------------ */

function PostMediaGallery({ media }: { media: PostMediaItem[] }) {
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const pdfs = media.filter((m) => m.type === "pdf");

  return (
    <>
      {/* Images: single item full-width, 2-4 in a 2-col grid */}
      {images.length === 1 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/5 bg-white/3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0].url}
            alt=""
            loading="lazy"
            className="max-h-[480px] w-full object-cover"
          />
        </div>
      ) : images.length > 1 ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {images.map((m, i) => (
            <div
              key={`image-${i}`}
              className={cn(
                "overflow-hidden rounded-xl border border-white/5 bg-white/3",
                images.length === 3 && i === 0 && "col-span-2"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt=""
                loading="lazy"
                className={cn(
                  "w-full object-cover",
                  images.length === 3 && i === 0 ? "max-h-[280px]" : "aspect-[4/3]"
                )}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Videos */}
      {videos.map((m, i) => (
        <div
          key={`video-${i}`}
          className="mt-3 overflow-hidden rounded-2xl border border-white/5 bg-black/40"
        >
          <video
            src={m.url}
            controls
            preload="metadata"
            playsInline
            className="max-h-[480px] w-full"
          />
        </div>
      ))}

      {/* PDFs: glass attachment rows */}
      {pdfs.map((m, i) => (
        <a
          key={`pdf-${i}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/5"
        >
          <Page className="h-5 w-5 shrink-0 text-mist" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {m.fileName || "Document"}
          </span>
          <span className="shrink-0 text-xs font-medium text-mist-dim">PDF</span>
        </a>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* PostCard                                                           */
/* ------------------------------------------------------------------ */

type PostCardProps = {
  post: PostView;
  /** Open the comment thread by default (used on /p/[id]). */
  defaultCommentsOpen?: boolean;
  /** Called after the owner deletes this post. */
  onDeleted?: (id: string) => void;
  className?: string;
};

export function PostCard({ post, defaultCommentsOpen, onDeleted, className }: PostCardProps) {
  const { data: session } = useSession();
  const isOwn = Boolean(session?.user?.id && session.user.id === post.user.id);

  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(defaultCommentsOpen));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const likeBusy = useRef(false);

  const bumpComments = useCallback((delta: number) => {
    setCommentCount((c) => Math.max(0, c + delta));
  }, []);

  async function toggleLike() {
    if (likeBusy.current) return;
    if (!session?.user) {
      toast.error("Sign in to like posts.");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    likeBusy.current = true;
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, {
        method: next ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      if (typeof data.liked === "boolean") setLiked(data.liked);
      if (typeof data.likeCount === "number") setLikeCount(data.likeCount);
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error("Couldn't update that like.");
    } finally {
      likeBusy.current = false;
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function deletePost() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Post deleted.");
      onDeleted?.(post.id);
    } catch {
      toast.error("Couldn't delete that post.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <GlassCard className={cn("p-5", className)}>
      {/* User row */}
      <div className="flex items-center gap-3">
        {post.user.handle ? (
          <Link href={`/u/${post.user.handle}`} className="shrink-0">
            <Avatar src={post.user.avatarWebpBase64} name={post.user.name} size={40} />
          </Link>
        ) : (
          <Avatar src={post.user.avatarWebpBase64} name={post.user.name} size={40} />
        )}
        <div className="min-w-0 flex-1">
          {post.user.handle ? (
            <Link
              href={`/u/${post.user.handle}`}
              className="block truncate text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              {post.user.name}
            </Link>
          ) : (
            <p className="truncate text-sm font-medium text-ink">{post.user.name}</p>
          )}
          <p className="truncate text-xs text-mist-dim">
            {post.user.handle ? `@${post.user.handle} · ` : ""}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {!isOwn && session?.user && post.user.id ? (
          <FollowButton userId={post.user.id} size="xs" />
        ) : null}
      </div>

      {/* Body */}
      {post.body ? (
        <PostBody
          body={post.body}
          className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/90"
        />
      ) : null}

      {/* Media */}
      {post.media.length > 0 ? <PostMediaGallery media={post.media} /> : null}

      {/* Action row */}
      <div className="mt-4 flex items-center gap-1">
        <button
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.95]",
            liked ? "text-ink" : "text-mist hover:bg-white/5 hover:text-ink"
          )}
        >
          {liked ? <HeartSolid className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
          {likeCount > 0 ? likeCount : null}
        </button>

        <button
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-label="Comments"
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            commentsOpen ? "text-ink" : "text-mist hover:bg-white/5 hover:text-ink"
          )}
        >
          <ChatBubble className="h-4 w-4" />
          {commentCount > 0 ? commentCount : null}
        </button>

        <button
          onClick={copyLink}
          aria-label="Copy link"
          className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/5 hover:text-ink"
        >
          <Copy className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        {isOwn ? (
          <button
            onClick={deletePost}
            disabled={deleting}
            aria-label="Delete post"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              confirmDelete
                ? "bg-white/10 text-ink"
                : "text-mist-dim hover:bg-white/5 hover:text-ink"
            )}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash className="h-4 w-4" />
            )}
            {confirmDelete && !deleting ? "Delete?" : null}
          </button>
        ) : null}
      </div>

      {commentsOpen ? <CommentThread postId={post.id} onCountChange={bumpComments} /> : null}
    </GlassCard>
  );
}
