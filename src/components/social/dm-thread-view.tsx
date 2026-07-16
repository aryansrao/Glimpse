"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Attachment,
  Camera,
  Check,
  Emoji,
  NavArrowLeft,
  RefreshDouble as Loader2,
  Reply as ReplyIcon,
  SendDiagonal,
  VideoCamera,
  Xmark,
} from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { playMessageSound } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import { clockTime, type DmMessage, type ReplyPreview, type SocialUser } from "./social-types";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

type ThreadMeta = {
  threadId: string;
  state: "accepted" | "request";
  otherUserId: string;
  otherUser: SocialUser | null;
  pendingApproval: boolean;
  requestForMe: boolean;
};

type DmThreadViewProps = {
  /** Overrides the route param — used when rendered inside the overlay. */
  threadId?: string;
  /** Rendered inside the overlay sheet: back button closes instead of navigating. */
  embedded?: boolean;
  onClose?: () => void;
};

/** Group raw reactions into pills: emoji → { count, mine }. */
function groupReactions(reactions: Array<{ emoji: string; userId: string }>, myId?: string) {
  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false };
    g.count += 1;
    if (myId && r.userId === myId) g.mine = true;
    groups.set(r.emoji, g);
  }
  return [...groups.entries()];
}

export function DmThreadView({ threadId: threadIdProp, embedded, onClose }: DmThreadViewProps) {
  const params = useParams<{ threadId?: string }>();
  const threadId = threadIdProp ?? params.threadId ?? "";
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [meta, setMeta] = useState<ThreadMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<string | null>(null);
  const [customEmoji, setCustomEmoji] = useState("");
  const [uploading, setUploading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const [initialTime] = useState(() => Date.now());
  const lastEventMs = useRef(initialTime);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const otherUser = meta?.otherUser ?? null;

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}/messages?limit=50`);
      if (res.status === 404 || res.status === 403) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't load this conversation.");
        return;
      }
      const data = await res.json();
      const list = (Array.isArray(data.messages) ? data.messages : []) as DmMessage[];
      list.forEach((m) => seenIds.current.add(m.id));
      setMessages(list);
      if (list.length) {
        lastEventMs.current = new Date(list[list.length - 1].createdAt).getTime();
      }
    } catch {
      toast.error("Couldn't load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}`);
      if (res.status === 404 || res.status === 403) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      setMeta((await res.json()) as ThreadMeta);
    } catch {
      // Header falls back to a skeleton.
    }
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages();
    loadMeta();
  }, [threadId, loadMessages, loadMeta]);

  // Live updates via SSE (poll-backed; ~5 min max lifetime, EventSource
  // auto-reconnects and seenIds dedupes any replayed messages).
  useEffect(() => {
    if (notFound || !threadId) return;
    const es = new EventSource(
      `/api/dms/${encodeURIComponent(threadId)}/events?since=${lastEventMs.current}`
    );
    es.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data) as DmMessage;
        if (!msg?.id || seenIds.current.has(msg.id)) return;
        seenIds.current.add(msg.id);
        lastEventMs.current = Math.max(
          lastEventMs.current,
          new Date(msg.createdAt).getTime() || Date.now()
        );
        setMessages((prev) => {
          // SSE payloads carry replyToId but no preview — resolve locally.
          if (msg.replyToId && !msg.replyPreview) {
            const target = prev.find((m) => m.id === msg.replyToId);
            if (target) {
              msg.replyPreview = {
                id: target.id,
                body: target.body ?? null,
                senderId: target.senderId,
                mediaType: target.mediaType ?? null,
              };
            }
          }
          return [...prev, msg];
        });
        if (msg.senderId !== myId) playMessageSound("receive");
      } catch {
        // Ignore malformed events.
      }
    });
    return () => es.close();
  }, [threadId, notFound, myId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Stop the camera stream whenever the capture sheet closes or we unmount.
  useEffect(() => {
    if (!cameraOpen) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  function goBack() {
    if (embedded && onClose) onClose();
    else router.push("/dms");
  }

  /* ------------------------------------------------------------ send */

  async function postMessage(payload: {
    body?: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  }) {
    const reply = replyTo;
    const tempId = `pending-${Date.now()}`;
    const optimistic: DmMessage = {
      id: tempId,
      senderId: myId ?? "me",
      body: payload.body ?? null,
      mediaUrl: payload.mediaUrl ?? null,
      mediaType: payload.mediaType ?? null,
      replyToId: reply?.id ?? null,
      replyPreview: reply
        ? {
            id: reply.id,
            body: reply.body ?? null,
            senderId: reply.senderId,
            mediaType: reply.mediaType ?? null,
          }
        : null,
      reactions: [],
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);
    setSending(true);

    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, replyToId: reply?.id ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : undefined);
      }
      const saved = data as DmMessage;
      if (saved?.id) {
        seenIds.current.add(saved.id);
        lastEventMs.current = Math.max(
          lastEventMs.current,
          new Date(saved.createdAt).getTime() || Date.now()
        );
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id)
            ? prev.filter((m) => m.id !== tempId)
            : prev.map((m) => (m.id === tempId ? { ...saved, reactions: [] } : m))
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        loadMessages();
      }
      // The recipient replying to a request accepts it implicitly.
      if (meta?.requestForMe) {
        setMeta((m) => (m ? { ...m, state: "accepted", requestForMe: false } : m));
      }
      playMessageSound("send");
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setReplyTo(reply);
      toast.error(
        err instanceof Error && err.message ? err.message : "Message didn't send. Try again."
      );
      return false;
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    const ok = await postMessage({ body });
    if (!ok) setDraft(body);
  }

  /* ----------------------------------------------------- reactions */

  async function react(message: DmMessage, emoji: string, remove: boolean) {
    setPickerFor(null);
    setActiveActions(null);
    setCustomEmoji("");
    if (message.pending) return;
    try {
      const res = await fetch(`/api/dms/messages/${encodeURIComponent(message.id)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remove ? { emoji, remove: true } : { emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't react.");
        return;
      }
      const reactions = Array.isArray(data.reactions) ? data.reactions : [];
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions } : m)));
    } catch {
      toast.error("Couldn't react.");
    }
  }

  function toggleReactionPill(message: DmMessage, emoji: string, mine: boolean) {
    react(message, emoji, mine);
  }

  /* --------------------------------------------------- attachments */

  async function uploadAndSend(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File is too large (max 8MB).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(typeof data.error === "string" ? data.error : "Upload failed. Try again.");
        return;
      }
      await postMessage({
        mediaUrl: data.url,
        mediaType: data.mediaType === "video" ? "video" : "image",
      });
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadAndSend(file);
  }

  /* -------------------------------------------------------- camera */

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // The <video> mounts on the next paint.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      // Permission denied or no camera — fall back to the native capture input.
      captureInputRef.current?.click();
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9)
    );
    setCameraOpen(false);
    if (!blob) {
      toast.error("Couldn't capture that. Try again.");
      return;
    }
    await uploadAndSend(new File([blob], "camera.webp", { type: "image/webp" }));
  }

  /* ---------------------------------------------------------- call */

  async function startCall() {
    if (!meta?.otherUserId || calling) return;
    setCalling(true);
    try {
      const res = await fetch("/api/calls/rejoin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: meta.otherUserId, mode: "video" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code || !data.hostToken) {
        toast.error(typeof data.error === "string" ? data.error : "Couldn't start the call.");
        return;
      }
      // The rejoin route already DMs them the invite link.
      router.push(`/room/${data.code}/host?token=${data.hostToken}`);
    } catch {
      toast.error("Couldn't start the call.");
    } finally {
      setCalling(false);
    }
  }

  /* ------------------------------------------------ request banner */

  async function acceptRequest() {
    if (deciding) return;
    setDeciding(true);
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Couldn't accept the request.");
        return;
      }
      setMeta((m) => (m ? { ...m, state: "accepted", requestForMe: false } : m));
      toast.success("Request accepted.");
    } catch {
      toast.error("Couldn't accept the request.");
    } finally {
      setDeciding(false);
    }
  }

  async function declineRequest() {
    if (deciding) return;
    setDeciding(true);
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(threadId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Couldn't decline the request.");
        return;
      }
      toast.success("Request declined.");
      goBack();
    } catch {
      toast.error("Couldn't decline the request.");
    } finally {
      setDeciding(false);
    }
  }

  /* ------------------------------------------------- interactions */

  function scrollToMessage(id: string) {
    const el = bubbleRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600);
  }

  function startLongPress(id: string) {
    longPressTimer.current = setTimeout(() => setActiveActions(id), 450);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function replyLabel(preview: ReplyPreview) {
    if (preview.body) return preview.body;
    if (preview.mediaType === "video") return "Video";
    if (preview.mediaType === "image") return "Photo";
    return "Attachment";
  }

  if (notFound) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <p className="text-mist">This conversation doesn&apos;t exist or isn&apos;t yours.</p>
        <Link href="/dms" className="text-sm text-mist-dim underline-offset-4 hover:underline">
          Back to messages
        </Link>
      </main>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-1 flex-col overflow-hidden",
        embedded ? "h-full" : "px-3 pb-3 sm:px-6 sm:pb-5"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col overflow-hidden",
          embedded ? "h-full" : "glass max-w-2xl rounded-[var(--radius-glass-lg)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
          <button
            onClick={goBack}
            className="cursor-pointer rounded-full p-1.5 text-mist transition-colors hover:bg-white/10 hover:text-ink"
            aria-label={embedded ? "Close conversation" : "Back to messages"}
          >
            {embedded ? <Xmark className="h-4 w-4" /> : <NavArrowLeft className="h-4 w-4" />}
          </button>
          {otherUser ? (
            <>
              {otherUser.handle ? (
                <Link
                  href={`/u/${otherUser.handle}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <Avatar src={otherUser.avatarWebpBase64} name={otherUser.name} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{otherUser.name}</p>
                    <p className="truncate text-xs text-mist-dim">@{otherUser.handle}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar src={otherUser.avatarWebpBase64} name={otherUser.name} size={34} />
                  <p className="truncate text-sm font-medium text-ink">{otherUser.name}</p>
                </div>
              )}
              <button
                onClick={startCall}
                disabled={calling}
                className="cursor-pointer rounded-full p-2 text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
                aria-label={`Start a video call with ${otherUser.name}`}
                title="Start a video call"
              >
                {calling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <VideoCamera className="h-4 w-4" />
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-white/8" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/8" />
            </div>
          )}
        </div>

        {/* Request banner */}
        {meta?.requestForMe ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-white/4 px-4 py-2.5">
            <p className="text-xs text-mist">
              {otherUser ? `${otherUser.name} wants to message you.` : "Message request."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={acceptRequest}
                disabled={deciding}
                className="flex cursor-pointer items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-void transition-all hover:bg-white disabled:opacity-50"
              >
                <Check className="h-3 w-3" /> Accept
              </button>
              <button
                onClick={declineRequest}
                disabled={deciding}
                className="glass flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
              >
                <Xmark className="h-3 w-3" /> Decline
              </button>
            </div>
          </div>
        ) : meta?.pendingApproval ? (
          <div className="border-b border-white/5 bg-white/4 px-4 py-2.5">
            <p className="text-xs text-mist-dim">
              Message request sent — they&apos;ll see your messages once they accept.
            </p>
          </div>
        ) : null}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-ink/70" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm text-mist">No messages yet.</p>
              <p className="text-xs text-mist-dim">Quiet is just the start of a conversation.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderId === myId;
              const next = messages[i + 1];
              const endOfRun = !next || next.senderId !== m.senderId;
              const pills = groupReactions(m.reactions ?? [], myId);
              const showActions = activeActions === m.id || pickerFor === m.id;
              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (el) bubbleRefs.current.set(m.id, el);
                    else bubbleRefs.current.delete(m.id);
                  }}
                  className={cn("group flex flex-col", mine ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "relative flex max-w-[85%] items-center gap-1",
                      mine ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-full rounded-3xl transition-shadow",
                        mine ? "rounded-br-lg" : "rounded-bl-lg",
                        m.mediaUrl ? "overflow-hidden p-1" : "px-4 py-2.5",
                        mine
                          ? "bg-white/90 text-void shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                          : "glass text-ink",
                        m.pending && "opacity-60",
                        highlightId === m.id && "ring-2 ring-white/50"
                      )}
                      title={clockTime(m.createdAt)}
                      onTouchStart={() => startLongPress(m.id)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                    >
                      {m.replyPreview ? (
                        <button
                          onClick={() => scrollToMessage(m.replyPreview!.id)}
                          className={cn(
                            "mb-1.5 block w-full cursor-pointer truncate rounded-2xl border-l-2 px-2.5 py-1.5 text-left text-xs",
                            mine
                              ? "border-void/30 bg-void/8 text-void/70"
                              : "border-white/30 bg-white/6 text-mist"
                          )}
                        >
                          <span className="mr-1 font-medium">
                            {m.replyPreview.senderId === myId ? "You" : otherUser?.name ?? "Them"}
                          </span>
                          {replyLabel(m.replyPreview)}
                        </button>
                      ) : null}
                      {m.mediaUrl ? (
                         m.mediaType === "video" ? (
                           <video
                             src={m.mediaUrl ?? undefined}
                             controls
                             playsInline
                             className="max-h-72 w-full rounded-[20px] object-cover"
                           />
                         ) : (
                           /* eslint-disable-next-line @next/next/no-img-element */
                           <img
                             src={m.mediaUrl ?? undefined}
                             alt="Shared media"
                             className="max-h-72 w-full rounded-[20px] object-cover"
                             loading="lazy"
                           />
                         )
                       ) : null}
                      {m.body ? (
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words text-[15px] leading-relaxed",
                            m.mediaUrl && "px-3 py-1.5"
                          )}
                        >
                          {m.body}
                        </p>
                      ) : null}
                    </div>

                    {/* Hover / long-press actions */}
                    {!m.pending ? (
                      <div
                        className={cn(
                          "flex shrink-0 items-center gap-0.5 transition-opacity",
                          showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        <button
                          onClick={() => {
                            setReplyTo(m);
                            setActiveActions(null);
                          }}
                          className="cursor-pointer rounded-full p-1.5 text-mist-dim transition-colors hover:bg-white/10 hover:text-ink"
                          aria-label="Reply to this message"
                        >
                          <ReplyIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setPickerFor((p) => (p === m.id ? null : m.id))}
                          className="cursor-pointer rounded-full p-1.5 text-mist-dim transition-colors hover:bg-white/10 hover:text-ink"
                          aria-label="React to this message"
                        >
                          <Emoji className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {/* Emoji picker */}
                    {pickerFor === m.id ? (
                      <div
                        className={cn(
                          "glass-strong absolute bottom-full z-10 mb-1 flex items-center gap-1 rounded-full px-2 py-1.5",
                          mine ? "right-0" : "left-0"
                        )}
                      >
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => react(m, emoji, false)}
                            className="cursor-pointer rounded-full p-1 text-base transition-transform hover:scale-125"
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <input
                          value={customEmoji}
                          onChange={(e) => setCustomEmoji(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && customEmoji.trim()) {
                              e.preventDefault();
                              react(m, customEmoji.trim().slice(0, 8), false);
                            }
                          }}
                          maxLength={8}
                          placeholder="…"
                          aria-label="Custom emoji reaction"
                          className="w-10 bg-transparent text-center text-sm text-ink outline-none placeholder:text-mist-dim"
                        />
                        <button
                          onClick={() => setPickerFor(null)}
                          className="cursor-pointer rounded-full p-1 text-mist-dim hover:text-ink"
                          aria-label="Close reactions"
                        >
                          <Xmark className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Reaction pills */}
                  {pills.length ? (
                    <div className={cn("mt-0.5 flex flex-wrap gap-1 px-1", mine && "justify-end")}>
                      {pills.map(([emoji, g]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReactionPill(m, emoji, g.mine)}
                          className={cn(
                            "flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                            g.mine
                              ? "bg-white/20 text-ink ring-1 ring-white/30"
                              : "glass text-mist hover:bg-white/10"
                          )}
                          aria-label={
                            g.mine ? `Remove your ${emoji} reaction` : `React with ${emoji}`
                          }
                        >
                          <span>{emoji}</span>
                          {g.count > 1 ? <span>{g.count}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {endOfRun ? (
                    <span className="mt-1 px-1 text-[10px] text-mist-dim">
                      {m.pending ? "Sending…" : clockTime(m.createdAt)}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Reply context */}
        {replyTo ? (
          <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2">
            <ReplyIcon className="h-3.5 w-3.5 shrink-0 text-mist-dim" />
            <p className="min-w-0 flex-1 truncate text-xs text-mist">
              Replying to{" "}
              <span className="font-medium">
                {replyTo.senderId === myId ? "yourself" : otherUser?.name ?? "them"}
              </span>
              {": "}
              {replyTo.body ?? (replyTo.mediaType === "video" ? "Video" : "Photo")}
            </p>
            <button
              onClick={() => setReplyTo(null)}
              className="cursor-pointer rounded-full p-1 text-mist-dim transition-colors hover:bg-white/10 hover:text-ink"
              aria-label="Cancel reply"
            >
              <Xmark className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* Composer */}
        <div className="flex items-center gap-1.5 border-t border-white/5 px-3 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm"
            className="hidden"
            onChange={onFilePicked}
          />
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-40"
            aria-label="Attach a photo or video"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Attachment className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={openCamera}
            disabled={uploading}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-40"
            aria-label="Take a photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={otherUser ? `Message ${otherUser.name.split(" ")[0]}…` : "Message…"}
            className="h-11 flex-1 rounded-full"
            maxLength={2000}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/90 text-void transition-all hover:bg-white active:scale-95 disabled:opacity-40"
            aria-label="Send message"
          >
            <SendDiagonal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Camera capture sheet */}
      {cameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-strong flex w-full max-w-md flex-col gap-3 rounded-[var(--radius-glass-lg)] p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
            />
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCameraOpen(false)}
                className="glass cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-void transition-all hover:bg-white active:scale-95"
              >
                <Camera className="h-4 w-4" /> Capture
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
