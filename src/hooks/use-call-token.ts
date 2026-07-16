"use client";

import { useCallback, useState } from "react";

export type Mode = "video" | "audio";

export type CallToken = { token: string; url: string };

/** Fetches a scoped LiveKit join token from /api/livekit/token for a given room + capability. */
export function useCallToken() {
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(
    async (params: { roomName: string; name: string; authToken: string }): Promise<CallToken | null> => {
      setError(null);
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          // Surface server-provided reasons (e.g. "Room is full.") verbatim.
          const data = await res.json().catch(() => null);
          setError(
            typeof data?.error === "string" && data.error
              ? data.error
              : "Couldn't start the call. Try again."
          );
          return null;
        }
        const data = await res.json();
        if (!data.token || !data.url) {
          setError("Calling isn't configured yet.");
          return null;
        }
        return { token: data.token as string, url: data.url as string };
      } catch {
        setError("Couldn't reach the calling service.");
        return null;
      }
    },
    []
  );

  return { fetchToken, error, setError };
}
