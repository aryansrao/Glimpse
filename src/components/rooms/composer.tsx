"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshDouble as Loader2, Attachment as Paperclip, SendDiagonal as Send } from "iconoir-react";
import { Button } from "@/components/ui/button";

export function Composer({
  slug,
  canSendMedia,
  onSent,
}: {
  slug: string;
  canSendMedia: boolean;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/chatrooms/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Couldn't send that message.");
        return;
      }
      onSent();
    } finally {
      setSending(false);
    }
  }

  async function sendFile(file: File) {
    setSending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch(`/api/chatrooms/${slug}/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? "Couldn't upload that file.");
        return;
      }
      const res = await fetch(`/api/chatrooms/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: uploadData.url, mediaType: uploadData.mediaType }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Couldn't send that attachment.");
        return;
      }
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-white/5 p-4">
      {canSendMedia ? (
        <>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
            title="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </>
      ) : null}

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendText();
          }
        }}
        placeholder="Message this room..."
        className="glass h-11 flex-1 rounded-full px-4 text-[15px] text-ink placeholder:text-mist-dim outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      />

      <Button
        type="button"
        size="icon"
        disabled={sending || !text.trim()}
        onClick={sendText}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
