"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshDouble as Loader2, VideoCamera as Video } from "iconoir-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Mode } from "@/hooks/use-call-token";

const ROOM_SIZES = [2, 4, 8, 12, 25] as const;
type RoomSize = (typeof ROOM_SIZES)[number];

export function CreateRoomDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<RoomSize>(8);
  const [room, setRoom] = useState<{
    code: string;
    hostToken: string;
  } | null>(null);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, maxParticipants }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data?.code || !data?.hostToken) throw new Error();
      setRoom(data);
    } catch {
      toast.error("Couldn't create the room. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRoom(null);
    setCopied(false);
  }

  const shareUrl = room && typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a private room</DialogTitle>
          <DialogDescription>
            Get a code only the people you share it with can use to join you.
          </DialogDescription>
        </DialogHeader>

        {!room ? (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="glass flex h-16 w-16 items-center justify-center rounded-full text-mist">
              <Video className="h-7 w-7" />
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-mist-dim">Room size</span>
              <div className="glass flex items-center gap-1 rounded-full p-1">
                {ROOM_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setMaxParticipants(size)}
                    aria-pressed={maxParticipants === size}
                    className={cn(
                      "h-8 px-3 rounded-full text-xs font-medium transition-all",
                      maxParticipants === size
                        ? "bg-white text-void"
                        : "text-mist hover:bg-white/10 hover:text-ink"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={create} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create room"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="glass-strong flex flex-col items-center gap-2 rounded-3xl py-6">
              <span className="text-xs uppercase tracking-[0.2em] text-mist-dim">Room code</span>
              <span className="font-mono text-4xl font-medium tracking-[0.15em] text-gradient">
                {room.code}
              </span>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm text-mist transition-colors hover:bg-white/10"
            >
              <span className="truncate">{shareUrl}</span>
              {copied ? <Check className="h-4 w-4 shrink-0 text-ink/80" /> : <Copy className="h-4 w-4 shrink-0" />}
            </button>

            <Button
              onClick={() =>
                router.push(
                  `/room/${room.code}/host?token=${room.hostToken}&mode=${mode}`
                )
              }
            >
              Enter room &amp; wait
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
