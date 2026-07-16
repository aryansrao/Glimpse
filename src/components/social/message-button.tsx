"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChatBubble, RefreshDouble as Loader2 } from "iconoir-react";
import { cn } from "@/lib/utils";

/**
 * Opens (or creates) a DM thread with a user and navigates to it.
 */
export function MessageButton({
  userId,
  className,
  label = "Message",
}: {
  userId: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/dms/with/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.threadId) {
        toast.error(
          typeof data.error === "string" ? data.error : "Couldn't start that conversation."
        );
        return;
      }
      // They don't follow you back yet — the thread landed as a request.
      if (data.pendingApproval) toast("Message request sent");
      router.push(`/dms/${data.threadId}`);
    } catch {
      toast.error("Couldn't start that conversation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className={cn(
        "glass inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink transition-all hover:bg-white/10 active:scale-[0.97] disabled:opacity-50",
        className
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChatBubble className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
