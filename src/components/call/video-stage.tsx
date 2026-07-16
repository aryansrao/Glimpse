"use client";

import { motion } from "framer-motion";
import {
  RefreshDouble as Loader2,
  MicrophoneMute as MicMuted,
  VideoCameraOff as VideoOff,
} from "iconoir-react";
import { Track, type Participant } from "livekit-client";
import {
  useIsMuted,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/components-react";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Mode } from "@/hooks/use-call-token";

function ParticipantTile({
  participant,
  trackRef,
  mode,
  fill,
  pip,
  fallbackName,
}: {
  participant: Participant;
  trackRef?: TrackReference;
  mode: Mode;
  /** Full-bleed main stage (no rounding/border of its own). */
  fill?: boolean;
  /** Tiny self-view — compact placeholder, no name pill. */
  pip?: boolean;
  fallbackName?: string | null;
}) {
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const camMuted = useIsMuted({ participant, source: Track.Source.Camera });
  const isLocal = participant.isLocal;
  const name = isLocal
    ? "You"
    : participant.name || participant.identity || fallbackName || "Stranger";
  const showVideo = mode === "video" && !!trackRef && !camMuted;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        !fill && "rounded-2xl bg-white/[0.04] sm:rounded-3xl",
        pip && "rounded-2xl"
      )}
    >
      {showVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn("h-full w-full object-cover", isLocal && "-scale-x-100")}
        />
      ) : (
        // Camera off / audio mode — avatar + name instead of black video.
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
          <Avatar name={name === "You" ? participant.name || "You" : name} size={pip ? 40 : 88} hue={220} />
          {!pip && <span className="max-w-full truncate text-sm font-medium text-mist">{name}</span>}
          {!pip && mode === "video" && (
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-mist-dim">
              <VideoOff className="h-3 w-3" /> Camera off
            </span>
          )}
        </div>
      )}

      {/* Name + muted indicator overlay */}
      <div className={cn("absolute flex items-center gap-1.5", pip ? "left-1.5 top-1.5" : "left-3 top-3")}>
        {!pip && showVideo && (
          <span className="glass max-w-40 truncate rounded-full px-3 py-1 text-xs font-medium text-ink">
            {name}
          </span>
        )}
        {micMuted && (
          <span
            aria-label={`${name} is muted`}
            title="Muted"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/85 text-white"
          >
            <MicMuted className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function VideoStage({
  partnerName,
  mode,
}: {
  partnerName: string | null;
  mode: Mode;
}) {
  const participants = useParticipants();
  const local = participants.find((p) => p.isLocal);
  const remotes = participants.filter((p) => !p.isLocal);

  const cameraTracks = useTracks([Track.Source.Camera]);
  const trackFor = (p: Participant) =>
    cameraTracks.find((t) => t.participant.identity === p.identity);

  const waiting = remotes.length === 0;

  return (
    <div className="relative h-full w-full overflow-hidden sm:rounded-[var(--radius-glass-lg)]">
      <GlimpseOrb />

      {waiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        >
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full glass">
            <div className="absolute inset-0 rounded-full animate-pulse-ring" />
            <Loader2 className="h-8 w-8 animate-spin text-ink/70" />
          </div>
          <p className="text-lg font-medium text-mist">Waiting for others to join...</p>
        </motion.div>
      )}

      {/* 1 remote: full-bleed main stage */}
      {!waiting && remotes.length === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
          <ParticipantTile
            participant={remotes[0]}
            trackRef={trackFor(remotes[0])}
            mode={mode}
            fill
            fallbackName={partnerName}
          />
        </motion.div>
      )}

      {/* 2 remotes: two-up (stacked mobile, side-by-side desktop) */}
      {!waiting && remotes.length === 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 grid grid-rows-2 gap-2 p-2 pb-[calc(env(safe-area-inset-bottom)+84px)] sm:grid-cols-2 sm:grid-rows-1 sm:gap-3 sm:p-3 sm:pb-28"
        >
          {remotes.map((p) => (
            <ParticipantTile key={p.identity} participant={p} trackRef={trackFor(p)} mode={mode} />
          ))}
        </motion.div>
      )}

      {/* 3-4 remotes: 2x2 grid */}
      {!waiting && remotes.length >= 3 && remotes.length <= 4 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2 pb-[calc(env(safe-area-inset-bottom)+84px)] sm:gap-3 sm:p-3 sm:pb-28"
        >
          {remotes.slice(0, 4).map((p) => (
            <ParticipantTile key={p.identity} participant={p} trackRef={trackFor(p)} mode={mode} />
          ))}
          {local && remotes.length < 4 && (
            <ParticipantTile participant={local} trackRef={trackFor(local)} mode={mode} />
          )}
        </motion.div>
      )}

      {/* 5-9 remotes: 3x3 grid */}
      {!waiting && remotes.length >= 5 && remotes.length <= 9 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 grid grid-cols-3 gap-2 overflow-y-auto p-2 pb-[calc(env(safe-area-inset-bottom)+84px)] sm:gap-3 sm:p-3 sm:pb-28"
        >
          {remotes.slice(0, 9).map((p) => (
            <ParticipantTile key={p.identity} participant={p} trackRef={trackFor(p)} mode={mode} />
          ))}
          {local && remotes.length < 9 && (
            <ParticipantTile participant={local} trackRef={trackFor(local)} mode={mode} />
          )}
        </motion.div>
      )}

      {/* 10+ remotes: 4-column scrollable grid */}
      {!waiting && remotes.length >= 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 grid auto-rows-min gap-2 p-2 pb-[calc(env(safe-area-inset-bottom)+84px)] overflow-y-auto sm:gap-3 sm:p-3 sm:pb-28"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          {remotes.map((p) => (
            <ParticipantTile key={p.identity} participant={p} trackRef={trackFor(p)} mode={mode} />
          ))}
          {local && (
            <ParticipantTile participant={local} trackRef={trackFor(local)} mode={mode} />
          )}
        </motion.div>
      )}

      {/* Local PiP — shown when the local tile isn't already in the grid (≤2 remotes) */}
      {local && !waiting && remotes.length <= 2 && (
        <div className="glass absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-10 h-28 w-20 overflow-hidden rounded-2xl sm:bottom-28 sm:right-5 sm:h-40 sm:w-28">
          <ParticipantTile participant={local} trackRef={trackFor(local)} mode={mode} pip />
        </div>
      )}
    </div>
  );
}
