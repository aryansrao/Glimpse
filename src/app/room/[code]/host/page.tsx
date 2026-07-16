"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallToken, type CallToken, type Mode } from "@/hooks/use-call-token";
import { CallShell } from "@/components/call/call-shell";
import { Navbar } from "@/components/home/navbar";

function RoomHostInner({ code }: { code: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { fetchToken, error: tokenError } = useCallToken();
  const [callToken, setCallToken] = useState<CallToken | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const initialized = useRef(false);

  const mode = (search.get("mode") === "audio" ? "audio" : "video") as Mode;
  const hostToken = search.get("token");

  useEffect(() => {
    if (!hostToken || initialized.current) return;
    initialized.current = true;

    (async () => {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) return;
      const room = await res.json();
      if (typeof room.maxParticipants === "number") {
        setMaxParticipants(room.maxParticipants);
      }
      const token = await fetchToken({
        roomName: `room-${code.toUpperCase()}`,
        name: room.hostName,
        authToken: hostToken,
      });
      setCallToken(token);
    })();

    const es = new EventSource(`/api/rooms/${code}/events`);
    es.addEventListener("joined", (e) => {
      const payload = JSON.parse((e as MessageEvent).data);
      setPartnerName(payload.guestName);
      es.close();
    });
    es.addEventListener("gone", () => es.close());
    es.addEventListener("timeout", () => es.close());

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostToken, code]);

  const handleLeave = useCallback(() => {
    fetch(`/api/rooms/${code}`, { method: "DELETE" }).catch(() => {});
    router.push("/");
  }, [code, router]);

  if (!hostToken) {
    router.replace(`/room/${code}`);
    return null;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <CallShell
        mode={mode}
        callToken={callToken}
        error={tokenError}
        partnerName={partnerName}
        maxParticipants={maxParticipants}
        searchLabel="Waiting for someone to join with your code..."
        onLeave={handleLeave}
      />
    </div>
  );
}

export default function RoomHostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = usePromise(params);
  return (
    <Suspense fallback={null}>
      <RoomHostInner code={code} />
    </Suspense>
  );
}
