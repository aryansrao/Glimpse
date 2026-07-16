"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ChatLines, RefreshDouble as Loader2 } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MIN_LEN = 3;
const MAX_LEN = 500;

type ConfessDialogProps = {
  handle: string;
  name: string;
};

/**
 * Anonymous confession composer for a public profile.
 * Open to everyone — guests included; no sender identity is sent or stored.
 */
export function ConfessDialog({ handle, name }: ConfessDialogProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const trimmed = body.trim();

  async function submit() {
    if (trimmed.length < MIN_LEN || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/confessions/to/${encodeURIComponent(handle)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.status === 201) {
        setBody("");
        setOpen(false);
        if (session?.user) {
          // Signed-in confessors can receive anonymous replies.
          toast.success("Confession sent anonymously — check Messages → Confessions for replies.");
        } else {
          toast.success("Confession sent — completely anonymously.");
        }
        return;
      }
      if (res.status === 429) {
        toast.error("Slow down — try again in a bit.");
        return;
      }
      let message = "Couldn't send that. Try again.";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // Non-JSON error body — keep the fallback.
      }
      toast.error(message);
    } catch {
      toast.error("Couldn't send that. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="glass flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink">
        <ChatLines className="h-3.5 w-3.5" />
        Confess
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-4">
          <DialogTitle>Leave an anonymous confession</DialogTitle>
          <DialogDescription>
            Say something to {name} — only they will see it.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={body}
          maxLength={MAX_LEN}
          rows={4}
          autoFocus
          placeholder="Type your confession…"
          onChange={(e) => setBody(e.target.value)}
          className="glass w-full resize-none rounded-2xl px-4 py-3 text-[15px] text-ink placeholder:text-mist-dim outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-white/30"
        />

        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-mist-dim">
            Completely anonymous — not even we know who sent it.
          </p>
          <span className="shrink-0 text-xs text-mist-dim">
            {body.length}/{MAX_LEN}
          </span>
        </div>

        <Button
          className="mt-5 w-full"
          onClick={submit}
          disabled={sending || trimmed.length < MIN_LEN}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sending ? "Sending…" : "Send confession"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
