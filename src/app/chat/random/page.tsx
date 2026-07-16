"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  RefreshDouble as Loader2,
  WarningCircle as AlertCircle,
  PhoneXmark as PhoneOff,
  Restart as RotateCcw,
} from "iconoir-react";
import type { CallToken, Mode } from "@/hooks/use-call-token";
import { useMatchmaking, type MatchResult } from "@/hooks/use-matchmaking";
import { CallShell } from "@/components/call/call-shell";
import { DockButton } from "@/components/call/control-dock";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GROUP_SIZES = [2, 3, 4, 5, 6] as const;
type GroupSize = (typeof GROUP_SIZES)[number];

type Stage = "perm" | "denied" | "countdown" | "idle" | "searching" | "connecting";

type RecentPartner = {
  user: { id: string; handle: string; name: string; avatarWebpBase64: string | null };
  mode: Mode;
  endedAt: string;
};

function GroupSizePicker({
  value,
  onChange,
}: {
  value: GroupSize;
  onChange: (size: GroupSize) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-mist-dim">Call size</span>
      <div className="glass flex items-center gap-1 rounded-full p-1">
        {GROUP_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => onChange(size)}
            aria-pressed={value === size}
            className={cn(
              "h-9 w-12 rounded-full text-sm font-medium transition-all",
              value === size ? "bg-white text-void" : "text-mist hover:bg-white/10 hover:text-ink"
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentPartners({ mode }: { mode: Mode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<RecentPartner[] | null>(null);
  const [rejoining, setRejoining] = useState<string | null>(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    fetch("/api/calls/recent")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
  }, [userId]);

  const rejoin = useCallback(
    async (partnerId: string) => {
      setRejoining(partnerId);
      try {
        const res = await fetch("/api/calls/rejoin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: partnerId, mode }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        router.push(`/room/${data.code}/host?token=${data.hostToken}&mode=${data.mode ?? mode}`);
      } catch {
        toast.error("Couldn't set up the rejoin room. Try again.");
        setRejoining(null);
      }
    },
    [mode, router]
  );

  if (!userId || !items || items.length === 0) return null;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-mist-dim">Recent</span>
      <div className="flex max-h-40 w-full flex-wrap items-center justify-center gap-2 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.user.id}
            className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5"
          >
            <Avatar src={item.user.avatarWebpBase64} name={item.user.name} size={28} />
            <span className="max-w-24 truncate text-sm text-ink">{item.user.name}</span>
            <button
              onClick={() => rejoin(item.user.id)}
              disabled={rejoining !== null}
              className="flex h-7 items-center rounded-full bg-white px-2.5 text-xs font-medium text-void transition-all hover:bg-white/90 active:scale-95 disabled:opacity-50"
            >
              {rejoining === item.user.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Rejoin"
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RandomChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: Mode = params.get("mode") === "audio" ? "audio" : "video";
  const { data: session } = useSession();

  const matchmaking = useMatchmaking();
  const [stage, setStage] = useState<Stage>("perm");
  const [groupSize, setGroupSize] = useState<GroupSize>(2);
  const [callToken, setCallToken] = useState<CallToken | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const roundRef = useRef(0);
  const matchRef = useRef<MatchResult | null>(null);
  const groupSizeRef = useRef<GroupSize>(2);
  const isSignedIn = !!session?.user;

  /* ---- camera / mic permission, then a short auto-start countdown ---- */

  const requestPermission = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: mode === "video" })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setStage("countdown");
      })
      .catch(() => {
        setStage("denied");
        toast.error(
          mode === "video"
            ? "Camera & microphone access is needed to start a glimpse."
            : "Microphone access is needed to start a glimpse."
        );
      });
  }, [mode]);

  useEffect(() => {
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------- rounds ---------------------------- */

  const recordCall = useCallback(() => {
    const match = matchRef.current;
    matchRef.current = null;
    if (!match || !isSignedIn) return;
    fetch("/api/calls/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: match.peerId }),
      keepalive: true,
    }).catch(() => {});
  }, [isSignedIn]);

  const startRound = useCallback(async () => {
    const myRound = ++roundRef.current;
    setPartnerName(null);
    setCallToken(null);
    setStage("searching");

    try {
      const match = await matchmaking.search(mode, groupSizeRef.current);
      if (roundRef.current !== myRound) return;
      matchRef.current = match;
      setPartnerName(match.partnerName);
      setStage("connecting");

      const res = await fetch("/api/queue/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: match.roomName,
          name: match.displayName,
          authToken: match.peerId,
        }),
      });
      if (roundRef.current !== myRound) return;
      const data = res.ok ? await res.json() : null;
      if (!data?.token || !data?.url) {
        matchRef.current = null;
        matchmaking.stop();
        setStage("idle");
        toast.error("Couldn't start the call. Try again.");
        return;
      }
      setCallToken({ token: data.token, url: data.url });
    } catch (err) {
      if (roundRef.current !== myRound) return;
      setStage("idle");
      const reason = err instanceof Error ? err.message : "";
      if (reason === "cancelled") return; // user cancelled — no noise
      matchmaking.stop(); // drop any orphaned queue entry
      if (reason === "timeout") {
        toast.error("No one showed up in time. Try again?");
      } else {
        toast.error("Matchmaking failed. Check your connection and try again.");
      }
    }
  }, [matchmaking, mode]);

  // Auto-start ~2s after permission is granted.
  useEffect(() => {
    if (stage !== "countdown") return;
    const t = setTimeout(() => startRound(), 2000);
    return () => clearTimeout(t);
  }, [stage, startRound]);

  const cancelSearch = useCallback(() => {
    roundRef.current++;
    matchmaking.stop();
    setStage("idle");
  }, [matchmaking]);

  const changeGroupSize = useCallback(
    (size: GroupSize) => {
      setGroupSize(size);
      groupSizeRef.current = size;
      // Requeue with the new size if we're already searching.
      if (stage === "searching") {
        roundRef.current++;
        matchmaking.stop();
        startRound();
      }
    },
    [stage, matchmaking, startRound]
  );

  const handleNext = useCallback(() => {
    recordCall();
    roundRef.current++;
    matchmaking.stop();
    setCallToken(null); // unmounts LiveKitRoom → disconnects
    startRound();
  }, [recordCall, matchmaking, startRound]);

  const handleLeave = useCallback(() => {
    recordCall();
    roundRef.current++;
    matchmaking.stop();
    router.push("/");
  }, [recordCall, matchmaking, router]);

  // Leave the queue when the page unmounts.
  useEffect(() => {
    return () => matchmaking.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ UI ------------------------------ */

  const searchingLabel =
    groupSize === 2 ? "Looking for someone..." : `Looking for ${groupSize - 1} people...`;

  const preCall = (
    <div className="relative min-h-0 flex-1 overflow-hidden sm:rounded-[var(--radius-glass-lg)]">
      <GlimpseOrb />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center">
        {stage === "denied" ? (
          <>
            <AlertCircle className="h-10 w-10 text-ink/80" />
            <p className="max-w-xs text-sm text-mist">
              {mode === "video" ? "Camera & microphone" : "Microphone"} access was blocked. Allow
              it in your browser, then try again.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setStage("perm");
                requestPermission();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
          </>
        ) : (
          <>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full glass">
              {(stage === "perm" || stage === "searching" || stage === "connecting" || stage === "countdown") && (
                <div className="absolute inset-0 rounded-full animate-pulse-ring" />
              )}
              <Loader2
                className={cn(
                  "h-8 w-8 text-ink/70",
                  stage !== "idle" && "animate-spin"
                )}
              />
            </div>
            <p className="text-lg font-medium text-mist">
              {stage === "perm" && "Checking camera & microphone..."}
              {stage === "countdown" && "Starting your glimpse..."}
              {stage === "searching" && searchingLabel}
              {stage === "connecting" && "Connecting..."}
              {stage === "idle" && "Ready when you are"}
            </p>

            {stage !== "connecting" && (
              <GroupSizePicker value={groupSize} onChange={changeGroupSize} />
            )}

            {stage === "idle" && (
              <Button onClick={startRound} className="px-8">
                Start searching
              </Button>
            )}

            {(stage === "countdown" || stage === "searching") && (
              <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-2.5">
                <DockButton onClick={cancelSearch} danger label="Cancel">
                  <PhoneOff className="h-5 w-5" />
                </DockButton>
              </div>
            )}

            <RecentPartners mode={mode} />
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <CallShell
        mode={mode}
        callToken={callToken}
        error={null}
        partnerName={partnerName}
        searchLabel={searchingLabel}
        onNext={handleNext}
        onLeave={handleLeave}
        onPartnerLeft={recordCall}
        interstitialExtra={<RecentPartners mode={mode} />}
        idleContent={preCall}
      />
    </div>
  );
}

export default function RandomChatPage() {
  return (
    <Suspense fallback={null}>
      <RandomChatInner />
    </Suspense>
  );
}
