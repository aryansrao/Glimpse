"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { NavArrowLeft, NavArrowRight, Trash, Xmark as X } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo, type StoryGroup } from "./social-types";

const STORY_DURATION_MS = 5000;
const TAP_MAX_MS = 250;

type StoryViewerProps = {
  groups: StoryGroup[];
  initialGroupIndex: number;
  currentUserId?: string;
  onClose: () => void;
  /** Fired when a story becomes active so the parent can flag it seen. */
  onSeen: (storyId: string) => void;
  /** Fired after the server confirms deletion of one of my stories. */
  onDeleted: (storyId: string) => void;
};

export function StoryViewer({
  groups,
  initialGroupIndex,
  currentUserId,
  onClose,
  onSeen,
  onDeleted,
}: StoryViewerProps) {
  const [pos, setPos] = useState({ g: initialGroupIndex, s: 0 });
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const pointerDownAt = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const groupsRef = useRef(groups);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    groupsRef.current = groups;
    onCloseRef.current = onClose;
  }, [groups, onClose]);

  const group = groups[Math.min(pos.g, groups.length - 1)] as StoryGroup | undefined;
  const story = group?.stories[Math.min(pos.s, (group?.stories.length ?? 1) - 1)];
  const isMine = Boolean(currentUserId && group && group.user.id === currentUserId);

  const advance = useCallback(
    (dir: 1 | -1) => {
      setPos((prev) => {
        const cur = groupsRef.current[prev.g];
        if (!cur) return prev;
        if (dir === 1) {
          if (prev.s < cur.stories.length - 1) return { g: prev.g, s: prev.s + 1 };
          if (prev.g < groupsRef.current.length - 1) return { g: prev.g + 1, s: 0 };
          // Past the last story — closing is a parent state update, so it
          // must happen outside this updater.
          queueMicrotask(onCloseRef.current);
          return prev;
        }
        if (prev.s > 0) return { g: prev.g, s: prev.s - 1 };
        if (prev.g > 0) {
          const prevGroup = groupsRef.current[prev.g - 1];
          return { g: prev.g - 1, s: Math.max(0, prevGroup.stories.length - 1) };
        }
        return prev;
      });
    },
    []
  );

  const jumpGroup = useCallback(
    (dir: 1 | -1) => {
      setPos((prev) => {
        const target = prev.g + dir;
        if (target < 0) return { g: prev.g, s: 0 };
        if (target > groupsRef.current.length - 1) {
          queueMicrotask(onCloseRef.current);
          return prev;
        }
        return { g: target, s: 0 };
      });
    },
    []
  );

  // If the parent's groups shrink (e.g. after deleting), keep indices valid.
  useEffect(() => {
    if (groups.length === 0) {
      onClose();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos((prev) => {
      const g = Math.min(prev.g, groups.length - 1);
      const s = Math.min(prev.s, groups[g].stories.length - 1);
      return g === prev.g && s === prev.s ? prev : { g, s };
    });
  }, [groups, onClose]);

  // Progress timer (rAF so pausing is exact).
  useEffect(() => {
    elapsedRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        elapsedRef.current += dt;
        const p = Math.min(1, elapsedRef.current / STORY_DURATION_MS);
        setProgress(p);
        if (p >= 1) {
          advance(1);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pos.g, pos.s, advance]);

  // Mark the active story viewed (once per open viewer).
  useEffect(() => {
    if (!story || story.seen || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    fetch(`/api/stories/${encodeURIComponent(story.id)}/view`, { method: "POST" }).catch(
      () => {}
    );
    onSeen(story.id);
  }, [story, onSeen]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowRight") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function deleteStory() {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(story.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data.error === "string" ? data.error : "Couldn't delete that story."
        );
        return;
      }
      toast.success("Story deleted.");
      onDeleted(story.id);
    } catch {
      toast.error("Couldn't delete that story.");
    } finally {
      setDeleting(false);
    }
  }

  if (!group || !story) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-void/95 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`${group.user.name}'s story`}
      >
        {/* Desktop group arrows */}
        {pos.g > 0 ? (
          <button
            onClick={() => jumpGroup(-1)}
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full glass p-3 text-mist transition-colors hover:text-ink sm:block"
            aria-label="Previous person"
          >
            <NavArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        {pos.g < groups.length - 1 ? (
          <button
            onClick={() => jumpGroup(1)}
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full glass p-3 text-mist transition-colors hover:text-ink sm:block"
            aria-label="Next person"
          >
            <NavArrowRight className="h-5 w-5" />
          </button>
        ) : null}

        <motion.div
          key={pos.g}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-void sm:h-[86dvh] sm:rounded-[var(--radius-glass-lg)] sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        >
          {/* Progress bars */}
          <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3">
            {group.stories.map((st, i) => (
              <div key={st.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white/90"
                  style={{
                    width: i < pos.s ? "100%" : i === pos.s ? `${progress * 100}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 pb-3 pt-7">
            <Avatar src={group.user.avatarWebpBase64} name={group.user.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{group.user.name}</p>
              <p className="text-xs text-mist">{timeAgo(story.createdAt)}</p>
            </div>
            {isMine ? (
              <button
                onClick={deleteStory}
                disabled={deleting}
                className="rounded-full bg-void/50 p-2 text-mist backdrop-blur-md transition-colors hover:text-ink disabled:opacity-50"
                aria-label="Delete story"
              >
                <Trash className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="rounded-full bg-void/50 p-2 text-mist backdrop-blur-md transition-colors hover:text-ink"
              aria-label="Close stories"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Media + tap zones */}
          <div
            className="relative flex flex-1 select-none items-center justify-center overflow-hidden"
            onPointerDown={() => {
              pointerDownAt.current = performance.now();
              pausedRef.current = true;
            }}
            onPointerUp={(e) => {
              pausedRef.current = false;
              const held = performance.now() - pointerDownAt.current;
              if (held < TAP_MAX_MS) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                advance(x < rect.width / 3 ? -1 : 1);
              }
            }}
            onPointerLeave={() => {
              pausedRef.current = false;
            }}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > 64) jumpGroup(dx < 0 ? 1 : -1);
            }}
          >
            {/* Story media are data/blob URLs — next/image is not applicable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.mediaUrl}
              alt={story.caption ?? `Story by ${group.user.name}`}
              className="pointer-events-none max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>

          {/* Caption */}
          {story.caption ? (
            <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-7">
              <p className="max-w-full rounded-2xl bg-void/60 px-4 py-2 text-center text-sm leading-relaxed text-ink backdrop-blur-md">
                {story.caption}
              </p>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
