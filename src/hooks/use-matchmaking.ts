"use client";

import { useCallback, useRef, useState } from "react";
import type { Mode } from "./use-call-token";

export type MatchmakingPhase = "idle" | "searching" | "matched";

export type MatchResult = {
  /** Opaque capability token for this searcher — authorizes /api/queue/token. */
  peerId: string;
  displayName: string;
  /** Shared LiveKit room name for everyone in the match (pair or group). */
  roomName: string;
  partnerName: string;
  isInitiator: boolean;
  groupSize: number;
};

export function useMatchmaking() {
  const [phase, setPhase] = useState<MatchmakingPhase>("idle");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const entryIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (entryIdRef.current) {
      fetch("/api/queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entryIdRef.current }),
        keepalive: true,
      }).catch(() => {});
      entryIdRef.current = null;
    }
    setPhase("idle");
  }, []);

  /**
   * Joins the queue for `mode` with the requested call size (2-4).
   * Resolves once the whole group is gathered. Rejects with an Error whose
   * message is one of "cancelled" | "gone" | "timeout" | "queue-failed" |
   * "network" so callers can surface the right feedback.
   */
  const search = useCallback((mode: Mode, groupSize: number = 2) => {
    setPhase("searching");
    setPartnerName(null);

    return new Promise<MatchResult>((resolve, reject) => {
      fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, groupSize }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("queue-failed");
          return r.json();
        })
        .then((data) => {
          entryIdRef.current = data.entryId;

          if (data.matched) {
            setPhase("matched");
            setPartnerName(data.partnerName);
            resolve({
              peerId: data.peerId,
              displayName: data.displayName,
              roomName: data.roomName,
              partnerName: data.partnerName,
              isInitiator: data.isInitiator,
              groupSize: data.groupSize ?? groupSize,
            });
            return;
          }

          const es = new EventSource(`/api/queue/${data.entryId}/events`);
          eventSourceRef.current = es;

          es.addEventListener("matched", (e) => {
            const payload = JSON.parse((e as MessageEvent).data);
            es.close();
            if (!payload.roomName) {
              reject(new Error("queue-failed"));
              return;
            }
            setPhase("matched");
            setPartnerName(payload.partnerName);
            resolve({
              peerId: data.peerId,
              displayName: data.displayName,
              roomName: payload.roomName,
              partnerName: payload.partnerName,
              isInitiator: payload.isInitiator,
              groupSize: payload.groupSize ?? groupSize,
            });
          });
          es.addEventListener("cancelled", () => {
            es.close();
            reject(new Error("cancelled"));
          });
          es.addEventListener("gone", () => {
            es.close();
            reject(new Error("gone"));
          });
          es.addEventListener("timeout", () => {
            es.close();
            reject(new Error("timeout"));
          });
          es.onerror = () => {
            // Browser auto-retries transient network errors; only bail if closed.
          };
        })
        .catch((err) => {
          setPhase("idle");
          reject(err instanceof Error ? err : new Error("network"));
        });
    });
  }, []);

  return { phase, partnerName, search, stop };
}
