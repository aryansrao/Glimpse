"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { VideoCamera as Video, RefreshDouble as Loader2 } from "iconoir-react";
import { useCallToken, type CallToken, type Mode } from "@/hooks/use-call-token";
import { CallShell } from "@/components/call/call-shell";
import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Button } from "@/components/ui/button";

type RoomInfo = {
  code: string;
  mode: Mode;
  hostName: string;
  status: string;
  maxParticipants: number;
};

function RoomJoinInner({ code }: { code: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const autoJoin = search.get("join") === "1";
  const { fetchToken, error: tokenError } = useCallToken();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [callToken, setCallToken] = useState<CallToken | null>(null);
  const autoJoinedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/rooms/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setRoom)
      .catch(() => setNotFound(true));
  }, [code]);

  const join = useCallback(async () => {
    if (!room) return;
    setJoining(true);
    try {
      // Every join mints a fresh participant token — no single guest slot.
      const res = await fetch(`/api/rooms/${code}/join`, { method: "POST" });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setJoined(true);

      const token = await fetchToken({
        roomName: `room-${code.toUpperCase()}`,
        name: data.name,
        authToken: data.participantToken,
      });
      setCallToken(token);
    } finally {
      setJoining(false);
    }
  }, [code, fetchToken, room]);

  // Rejoin invites link here with ?join=1 — skip the confirm step once.
  useEffect(() => {
    if (autoJoin && room && !joined && !joining && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      join();
    }
  }, [autoJoin, room, joined, joining, join]);

  const handleLeave = useCallback(() => {
    router.push("/");
  }, [router]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="relative flex flex-1 items-center justify-center px-6">
          <GlimpseOrb className="-z-10" />
          <GlassCard strong className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <p className="font-display text-lg font-medium">Room not found</p>
            <p className="text-sm text-mist">This code may be wrong or the room has expired.</p>
            <Button size="sm" onClick={() => router.push("/")}>
              Go home
            </Button>
          </GlassCard>
        </main>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="relative flex flex-1 items-center justify-center px-6">
          <GlimpseOrb className="-z-10" />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard strong className="flex max-w-sm flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/8 text-ink">
                <Video className="h-6 w-6" />
              </div>
              {room ? (
                <>
                  <p className="font-display text-lg font-medium">
                    Join {room.hostName}&apos;s room?
                  </p>
                  <p className="font-mono text-sm tracking-[0.2em] text-mist-dim">{code}</p>
                  <Button onClick={join} disabled={joining} className="w-full">
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join call"}
                  </Button>
                </>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-ink/70" />
              )}
            </GlassCard>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <CallShell
        mode={room?.mode ?? "video"}
        callToken={callToken}
        error={tokenError}
        partnerName={room?.hostName ?? null}
        maxParticipants={room?.maxParticipants ?? null}
        searchLabel="Connecting..."
        onLeave={handleLeave}
      />
    </div>
  );
}

export default function RoomJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = usePromise(params);
  return (
    <Suspense fallback={null}>
      <RoomJoinInner code={code} />
    </Suspense>
  );
}
