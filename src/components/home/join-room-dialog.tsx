"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key as KeyRound, RefreshDouble as Loader2 } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function JoinRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError("Enter the full room code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${clean}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "That room couldn't be found.");
        return;
      }
      router.push(`/room/${clean}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a room</DialogTitle>
          <DialogDescription>Enter the code someone shared with you.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              maxLength={8}
              className="pl-11 font-mono text-lg tracking-[0.2em]"
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
          </div>
          {error ? <p className="text-sm text-ink">{error}</p> : null}
          <Button onClick={join} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
