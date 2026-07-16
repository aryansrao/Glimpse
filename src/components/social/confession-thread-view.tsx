"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { MaskSquare, NavArrowLeft, RefreshDouble as Loader2, SendDiagonal } from "iconoir-react";
import { Input } from "@/components/ui/input";
import { playMessageSound } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import { clockTime } from "./social-types";

type ConfessionMessage = {
  id: string;
  fromOwner: boolean;
  body: string;
  createdAt: string;
};

type ConfessionMeta = {
  id: string;
  body: string;
  createdAt: string;
};

/**
 * Chat-style thread for a confession. The other side is always
 * "Anonymous": the recipient never learns the sender, and the sender
 * stays anonymous even in their own view.
 */
export function ConfessionThreadView() {
  const params = useParams<{ id: string }>();
  const confessionId = params.id;

  const [messages, setMessages] = useState<ConfessionMessage[]>([]);
  const [confession, setConfession] = useState<ConfessionMeta | null>(null);
  const [role, setRole] = useState<"recipient" | "sender" | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/confessions/${encodeURIComponent(confessionId)}/messages?limit=50`
      );
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't load this confession.");
        return;
      }
      const data = await res.json();
      setMessages((Array.isArray(data.messages) ? data.messages : []) as ConfessionMessage[]);
      if (data.confession) setConfession(data.confession as ConfessionMeta);
      if (data.role === "recipient" || data.role === "sender") setRole(data.role);
    } catch {
      toast.error("Couldn't load this confession.");
    } finally {
      setLoading(false);
    }
  }, [confessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, confession]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || !role) return;

    const tempId = `pending-${Date.now()}`;
    const optimistic: ConfessionMessage = {
      id: tempId,
      // Recipient messages carry fromOwner=true, sender messages false.
      fromOwner: role === "recipient",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch(`/api/confessions/${encodeURIComponent(confessionId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : undefined);
      }
      const saved = data as ConfessionMessage;
      if (saved?.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id)
            ? prev.filter((m) => m.id !== tempId)
            : prev.map((m) => (m.id === tempId ? saved : m))
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        load();
      }
      playMessageSound("send");
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      toast.error(
        err instanceof Error && err.message ? err.message : "Message didn't send. Try again."
      );
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <p className="text-mist">This confession doesn&apos;t exist or isn&apos;t yours.</p>
        <Link href="/dms" className="text-sm text-mist-dim underline-offset-4 hover:underline">
          Back to messages
        </Link>
      </main>
    );
  }

  /** "mine" = messages I wrote, shown on the right. */
  const isMine = (m: ConfessionMessage) =>
    role === "recipient" ? m.fromOwner : !m.fromOwner;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="glass mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-[var(--radius-glass-lg)]">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
          <Link
            href="/dms"
            className="rounded-full p-1.5 text-mist transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Back to messages"
          >
            <NavArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="glass flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-mist"
            >
              <MaskSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">Anonymous</p>
              <p className="truncate text-xs text-mist-dim">
                {role === "sender"
                  ? "Sent by you — they can't see who you are"
                  : "Received confession"}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-ink/70" />
            </div>
          ) : (
            <>
              {/* The original confession opens the thread, from the confessor's side. */}
              {confession ? (
                <div
                  className={cn(
                    "flex flex-col",
                    role === "sender" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed",
                      role === "sender"
                        ? "rounded-br-lg bg-white/90 text-void shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "rounded-bl-lg glass text-ink"
                    )}
                    title={clockTime(confession.createdAt)}
                  >
                    {confession.body}
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-mist-dim">
                    {clockTime(confession.createdAt)}
                  </span>
                </div>
              ) : null}

              {messages.length === 0 && !confession ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <p className="text-sm text-mist">No messages yet.</p>
                  <p className="text-xs text-mist-dim">
                    Start a conversation in complete silence.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const mine = isMine(m);
                  const next = messages[i + 1];
                  const endOfRun = !next || next.fromOwner !== m.fromOwner;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed",
                          mine
                            ? "rounded-br-lg bg-white/90 text-void shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                            : "rounded-bl-lg glass text-ink"
                        )}
                        title={clockTime(m.createdAt)}
                      >
                        {m.body}
                      </div>
                      {endOfRun ? (
                        <span className="mt-1 px-1 text-[10px] text-mist-dim">
                          {clockTime(m.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 border-t border-white/5 px-3 py-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={role === "sender" ? "Reply anonymously…" : "Reply…"}
            className="h-11 flex-1 rounded-full"
            maxLength={2000}
            disabled={!role}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending || !role}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/90 text-void transition-all hover:bg-white active:scale-95 disabled:opacity-40"
            aria-label="Send reply"
          >
            <SendDiagonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
