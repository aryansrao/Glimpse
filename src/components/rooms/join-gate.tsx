"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshDouble as Loader2, Lock } from "iconoir-react";
import { GlassCard } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinGate({
  slug,
  visibility,
  initialInviteCode,
  onJoined,
}: {
  slug: string;
  visibility: "public" | "private";
  initialInviteCode?: string;
  onJoined: () => void;
}) {
  const { status } = useSession();
  const [code, setCode] = useState(initialInviteCode ?? "");
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    try {
      const res = await fetch(`/api/chatrooms/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't join this room.");
        return;
      }
      toast.success("Joined room.");
      onJoined();
    } finally {
      setJoining(false);
    }
  }

  if (visibility === "private" && status !== "authenticated") {
    return (
      <GlassCard strong className="mx-auto max-w-sm p-8 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-mist-dim" />
        <p className="mb-4 text-mist">Sign in to join this private room.</p>
        <Button asChild className="w-full">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </GlassCard>
    );
  }

  return (
    <GlassCard strong className="mx-auto max-w-sm p-8 text-center">
      <Lock className="mx-auto mb-3 h-6 w-6 text-mist-dim" />
      {visibility === "private" ? (
        <>
          <p className="mb-4 text-mist">This is a private room. Enter an invite code to join.</p>
          <div className="mb-4 text-left">
            <Label>Invite code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" />
          </div>
        </>
      ) : (
        <p className="mb-4 text-mist">Join this room to see messages and chat.</p>
      )}
      <Button className="w-full" onClick={join} disabled={joining || (visibility === "private" && !code)}>
        {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Join room
      </Button>
    </GlassCard>
  );
}
