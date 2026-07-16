"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DmThreadView } from "./dm-thread-view";

type DmOverlayProps = {
  /** Thread to show; null keeps the sheet closed. */
  threadId: string | null;
  onClose: () => void;
};

/**
 * Right-side sheet that renders the same DM thread component used by the
 * /dms/[threadId] page, without leaving the current page.
 */
export function DmOverlay({ threadId, onClose }: DmOverlayProps) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Close on Escape while open.
  useEffect(() => {
    if (!threadId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [threadId]);

  return (
    <AnimatePresence>
      {threadId ? (
        <motion.div
          key="dm-overlay"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            aria-label="Close conversation"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />
          <motion.aside
            role="dialog"
            aria-label="Conversation"
            className="glass-strong absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-hidden sm:my-3 sm:mr-3 sm:rounded-[var(--radius-glass-lg)]"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <DmThreadView threadId={threadId} embedded onClose={onClose} />
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
