"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Attachment as AttachmentIcon,
  MediaVideo,
  Page,
  RefreshDouble as Loader2,
  Xmark,
} from "iconoir-react";
import { GlassCard } from "@/components/glass/glass-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fileToStoryWebpBase64 } from "@/components/social/story-image";
import { cn } from "@/lib/utils";
import { extractPostTags, toPostView, type PostMediaType, type PostView } from "./post-types";

const MAX_ATTACHMENTS = 4;
const MAX_RAW_BYTES = 8 * 1024 * 1024; // 8MB pre-check for videos/PDFs

type ComposerAttachment = {
  id: string;
  type: PostMediaType;
  dataBase64: string;
  fileName: string | null;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AttachmentChip({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: ComposerAttachment;
  onRemove: () => void;
  disabled: boolean;
}) {
  const removeButton = (
    <button
      onClick={onRemove}
      disabled={disabled}
      aria-label={`Remove ${attachment.fileName ?? attachment.type}`}
      className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-ink backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-50"
    >
      <Xmark className="h-3 w-3" />
    </button>
  );

  if (attachment.type === "image") {
    return (
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.dataBase64}
          alt={attachment.fileName ?? "Attached image"}
          className="h-full w-full object-cover"
        />
        {removeButton}
      </div>
    );
  }

  const Icon = attachment.type === "video" ? MediaVideo : Page;
  return (
    <div className="glass relative flex h-20 w-32 shrink-0 flex-col justify-between rounded-xl border border-white/8 p-2.5">
      <Icon className="h-5 w-5 text-mist" />
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-tight text-ink">
          {attachment.fileName ?? (attachment.type === "video" ? "Video" : "Document")}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-mist-dim">
          {attachment.type === "video" ? "Video" : "PDF"}
        </p>
      </div>
      {removeButton}
    </div>
  );
}

type PostComposerProps = {
  /** Called with the created post so feeds can prepend it. */
  onPosted?: (post: PostView) => void;
  className?: string;
};

export function PostComposer({ onPosted, className }: PostComposerProps) {
  const { data: session } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [processing, setProcessing] = useState(false);
  const [posting, setPosting] = useState(false);

  if (!session?.user) return null;

  const tags = extractPostTags(body);
  const canPost = !posting && !processing && (body.trim().length > 0 || attachments.length > 0);

  async function handleFiles(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_ATTACHMENTS} attachments per post.`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more attachment${room === 1 ? "" : "s"} will fit.`);
    }

    setProcessing(true);
    try {
      const next: ComposerAttachment[] = [];
      for (const file of files.slice(0, room)) {
        try {
          if (file.type.startsWith("image/")) {
            next.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: "image",
              dataBase64: await fileToStoryWebpBase64(file),
              fileName: file.name || null,
            });
          } else if (file.type === "video/mp4" || file.type === "video/webm") {
            if (file.size > MAX_RAW_BYTES) {
              toast.error(`"${file.name}" is over 8MB.`);
              continue;
            }
            next.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: "video",
              dataBase64: await readFileAsDataUrl(file),
              fileName: file.name || null,
            });
          } else if (file.type === "application/pdf") {
            if (file.size > MAX_RAW_BYTES) {
              toast.error(`"${file.name}" is over 8MB.`);
              continue;
            }
            next.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: "pdf",
              dataBase64: await readFileAsDataUrl(file),
              fileName: file.name || null,
            });
          } else {
            toast.error(`"${file.name}" isn't a supported file type.`);
          }
        } catch {
          toast.error(`Couldn't process "${file.name}".`);
        }
      }
      if (next.length > 0) setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setBody("");
    setAttachments([]);
    setExpanded(false);
  }

  async function submit() {
    if (!canPost) return;
    setPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim() || undefined,
          media:
            attachments.length > 0
              ? attachments.map((a) => ({
                  dataBase64: a.dataBase64,
                  type: a.type,
                  fileName: a.fileName ?? undefined,
                }))
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : res.status === 503
              ? "Media uploads aren't available right now."
              : "Couldn't post right now."
        );
        return;
      }
      const post = toPostView(data.post ?? data);
      toast.success("Posted.");
      reset();
      if (post) onPosted?.(post);
    } catch {
      toast.error("Couldn't post right now.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <GlassCard className={className}>
      {!expanded ? (
        <button
          onClick={() => {
            setExpanded(true);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
          className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
        >
          <Avatar
            src={session.user.avatarWebpBase64}
            name={session.user.name ?? "You"}
            size={36}
          />
          <span className="flex-1 text-sm text-mist-dim">Share something...</span>
          <AttachmentIcon className="h-4.5 w-4.5 shrink-0 text-mist-dim" />
        </button>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar
              src={session.user.avatarWebpBase64}
              name={session.user.name ?? "You"}
              size={36}
            />
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share something... add #tags anywhere"
              maxLength={1000}
              rows={3}
              className="min-h-[72px] w-full resize-none bg-transparent pt-1.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-mist-dim"
              aria-label="Post body"
            />
          </div>

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
              {tags.map((t) => (
                <span
                  key={t}
                  className="glass rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs text-mist"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {attachments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 pl-12">
              {attachments.map((a) => (
                <AttachmentChip
                  key={a.id}
                  attachment={a}
                  disabled={posting}
                  onRemove={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) void handleFiles(files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={processing || posting || attachments.length >= MAX_ATTACHMENTS}
              aria-label="Attach media"
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                "text-mist hover:bg-white/5 hover:text-ink"
              )}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AttachmentIcon className="h-4 w-4" />
              )}
              {attachments.length > 0 ? `Media ${attachments.length}/${MAX_ATTACHMENTS}` : "Media"}
            </button>

            <div className="flex items-center gap-2">
              {posting && attachments.length > 0 ? (
                <span className="text-xs text-mist-dim" role="status">
                  Uploading {attachments.length}{" "}
                  {attachments.length === 1 ? "attachment" : "attachments"}...
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={reset} disabled={posting}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={!canPost}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
