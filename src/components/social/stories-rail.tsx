"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { StoryComposer } from "./story-composer";
import { StoryViewer } from "./story-viewer";
import type { StoryGroup } from "./social-types";

/**
 * Horizontal stories rail: "+" tile first (opens the composer), then one
 * ring per person. Unseen rings are brighter. Tapping a ring opens the
 * full-screen viewer.
 */
export function StoriesRail({ className }: { className?: string }) {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stories/feed");
      if (!res.ok) {
        // Feed route may not be live yet — show just the "+" tile quietly.
        setGroups([]);
        setFailed(res.status >= 500);
        return;
      }
      const data = await res.json();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setFailed(false);
    } catch {
      setGroups([]);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const markSeen = useCallback((storyId: string) => {
    setGroups((prev) => {
      if (!prev) return prev;
      return prev.map((g) => {
        if (!g.stories.some((s) => s.id === storyId)) return g;
        const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
        return { ...g, stories, allSeen: stories.every((s) => s.seen) };
      });
    });
  }, []);

  const removeStory = useCallback((storyId: string) => {
    setGroups((prev) => {
      if (!prev) return prev;
      return prev
        .map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) }))
        .filter((g) => g.stories.length > 0);
    });
  }, []);

  const loading = groups === null;
  const me = session?.user;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Your story / composer tile */}
        <button
          onClick={() => setComposerOpen(true)}
          className="group flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1.5"
        >
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/25 p-[3px] transition-colors group-hover:border-white/50">
            {me ? (
              <Avatar src={me.avatarWebpBase64} name={me.name ?? "You"} size={54} />
            ) : (
              <span className="glass flex h-[54px] w-[54px] items-center justify-center rounded-full text-mist">
                <Plus className="h-5 w-5" />
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-void shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              <Plus className="h-3 w-3" strokeWidth={2.5} />
            </span>
          </span>
          <span className="w-full truncate text-center text-xs text-mist">Your story</span>
        </button>

        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <div className="h-16 w-16 animate-pulse rounded-full bg-white/8" />
                <div className="h-3 w-10 animate-pulse rounded-full bg-white/8" />
              </div>
            ))
          : groups.map((group, i) => (
              <button
                key={group.user.id}
                onClick={() => setViewerIndex(i)}
                className="group flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full border-2 p-[3px] transition-all",
                    group.allSeen
                      ? "border-white/15"
                      : "border-white/85 shadow-[0_0_18px_-4px_rgba(255,255,255,0.35)]"
                  )}
                >
                  <Avatar
                    src={group.user.avatarWebpBase64}
                    name={group.user.name}
                    size={54}
                    className={group.allSeen ? "opacity-70" : ""}
                  />
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-xs",
                    group.allSeen ? "text-mist-dim" : "text-mist"
                  )}
                >
                  {group.user.id === me?.id ? "You" : group.user.name.split(" ")[0]}
                </span>
              </button>
            ))}

        {!loading && groups.length === 0 ? (
          <div className="flex shrink-0 items-center pl-1 pr-4">
            <p className="text-xs text-mist-dim">
              {failed
                ? "Stories are quiet right now — try again soon."
                : "No stories yet. Yours could be first."}
            </p>
          </div>
        ) : null}
      </div>

      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} onPosted={load} />

      {viewerIndex !== null && groups && groups.length > 0 ? (
        <StoryViewer
          groups={groups}
          initialGroupIndex={Math.min(viewerIndex, groups.length - 1)}
          currentUserId={me?.id}
          onClose={() => setViewerIndex(null)}
          onSeen={markSeen}
          onDeleted={removeStory}
        />
      ) : null}
    </div>
  );
}
