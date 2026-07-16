"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PostCard } from "./post-card";
import { PostComposer } from "./post-composer";
import { PostSkeletons } from "./post-feed";
import { toPostViews, type PostView } from "./post-types";

/**
 * Posts by one user, shown under their profile card.
 * GET /api/posts/user/[handle] pages with an epoch-ms time cursor.
 */
export function UserPosts({ handle, className }: { handle: string; className?: string }) {
  const { data: session } = useSession();
  const isOwn = session?.user?.handle === handle;

  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<number | null>(null);
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const qs = cursorRef.current !== null ? `?cursor=${cursorRef.current}` : "";
      const res = await fetch(`/api/posts/user/${encodeURIComponent(handle)}${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const page = toPostViews(data.posts);
      setPosts((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...page.filter((p) => !seen.has(p.id))];
      });
      if (typeof data.nextCursor === "number") {
        cursorRef.current = data.nextCursor;
      } else {
        setDone(true);
      }
    } catch {
      // Posts API may not exist yet — settle quietly.
      setPosts((prev) => prev ?? []);
      setDone(true);
    } finally {
      loading.current = false;
    }
  }, [handle]);

  useEffect(() => {
    cursorRef.current = null;
    const t = window.setTimeout(() => {
      setPosts(null);
      setDone(false);
      void loadMore();
    }, 0);
    return () => window.clearTimeout(t);
  }, [handle, loadMore]);

  const displayName = handle.startsWith("@") ? handle : `@${handle}`;

  return (
    <section className={className}>
      <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-mist-dim">
        Posts
      </h2>

      {isOwn ? (
        <PostComposer
          onPosted={(post) => setPosts((prev) => [post, ...(prev ?? [])])}
          className="mb-3"
        />
      ) : null}

      {posts === null ? (
        <PostSkeletons count={2} />
      ) : posts.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-10 text-center">
          {isOwn ? (
            <p className="text-sm text-mist">No posts yet — share your first one above.</p>
          ) : (
            <>
              <p className="text-sm text-mist">
                {displayName} is a little shy — nothing posted yet.
              </p>
              <p className="mt-1 text-xs text-mist-dim">
                Follow them to catch their first post.
              </p>
            </>
          )}
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
          {!done ? (
            <button
              onClick={() => void loadMore()}
              className="glass mx-auto cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink"
            >
              Load more
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
