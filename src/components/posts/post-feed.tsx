"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubbleEmpty } from "iconoir-react";
import { PostCard } from "./post-card";
import { PostComposer } from "./post-composer";
import { toPostViews, type PostView } from "./post-types";

export function PostSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass animate-pulse rounded-[var(--radius-glass)] p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/8" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded-full bg-white/8" />
              <div className="h-2.5 w-20 rounded-full bg-white/5" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-white/5" />
            <div className="h-3 w-2/3 rounded-full bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sentinel that fires `onVisible` when scrolled into view. */
function LoadMoreSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);

  useEffect(() => {
    cb.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="h-px" aria-hidden />;
}

/**
 * Ranked home feed: composer + infinite scroll over GET /api/posts/feed.
 * Cursor is an offset integer.
 */
export function HomeFeed({ className }: { className?: string }) {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(0);
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading.current || cursor === null) return;
    loading.current = true;
    try {
      const res = await fetch(`/api/posts/feed?cursor=${cursor}&limit=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const page = toPostViews(data.posts);
      setPosts((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...page.filter((p) => !seen.has(p.id))];
      });
      setCursor(typeof data.nextCursor === "number" ? data.nextCursor : null);
    } catch {
      // Feed API may not exist yet — settle quietly.
      setPosts((prev) => prev ?? []);
      setCursor(null);
    } finally {
      loading.current = false;
    }
  }, [cursor]);

  useEffect(() => {
    // Initial load only — subsequent pages come from the sentinel.
    const t = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className}>
      <PostComposer
        onPosted={(post) => setPosts((prev) => [post, ...(prev ?? [])])}
        className="mb-3"
      />

      {posts === null ? (
        <PostSkeletons />
      ) : posts.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
          <ChatBubbleEmpty className="h-5 w-5 text-mist-dim" />
          <p className="text-sm text-mist">Nothing here yet.</p>
          <p className="text-xs text-mist-dim">Follow people or post something.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((prev) => (prev ?? []).filter((p) => p.id !== id))}
            />
          ))}
          {cursor !== null ? (
            <>
              <LoadMoreSentinel onVisible={loadMore} />
              <PostSkeletons count={1} />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
