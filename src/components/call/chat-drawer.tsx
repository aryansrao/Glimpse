"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SendDiagonal as Send, Xmark as X } from "iconoir-react";
import { useDataChannel } from "@livekit/components-react";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  from: string | null;
  at: number;
};

const CHAT_TOPIC = "glimpse-chat";

/** Rides LiveKit's built-in data channel instead of a raw RTCDataChannel. */
export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const { send } = useDataChannel(CHAT_TOPIC, (msg) => {
    if (msg.from?.isLocal) return;
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as { text: string };
      const from = msg.from?.name || msg.from?.identity || null;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: payload.text, fromMe: false, from, at: Date.now() },
      ]);
    } catch {
      // ignore malformed payloads
    }
  });

  const sendMessage = useCallback(
    (text: string) => {
      const bytes = new TextEncoder().encode(JSON.stringify({ text }));
      send(bytes, {});
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, fromMe: true, from: null, at: Date.now() },
      ]);
    },
    [send]
  );

  return { messages, sendMessage };
}

export function ChatDrawer({
  open,
  onClose,
  messages,
  onSend,
  showSenders,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  /** Label bubbles with the sender's name — useful in group calls. */
  showSenders?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the list pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="glass-strong flex h-full min-h-0 w-full flex-col rounded-[28px] p-4 sm:rounded-[var(--radius-glass-lg)] sm:p-5"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h3 className="font-display text-sm font-medium text-ink">Chat</h3>
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-mist hover:bg-white/10 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
          >
            {messages.length === 0 && (
              <p className="mt-8 text-center text-sm text-mist-dim">
                Say hi — messages stay in this call.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm",
                    m.fromMe ? "bg-white text-void" : "glass text-ink"
                  )}
                >
                  {showSenders && !m.fromMe && m.from && (
                    <span className="mb-0.5 block text-[11px] font-medium text-mist">{m.from}</span>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex shrink-0 items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Message..."
              className="glass h-11 min-w-0 flex-1 rounded-full px-4 text-sm text-ink placeholder:text-mist-dim outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <button
              onClick={submit}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-void transition-transform active:scale-90"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
