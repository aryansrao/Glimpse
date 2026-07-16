"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WarningCircle as AlertCircle,
  PhoneXmark as PhoneOff,
  Restart as RotateCcw,
  RefreshDouble as Loader2,
  Group as GroupIcon,
} from "iconoir-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useRemoteParticipants,
} from "@livekit/components-react";
import { VideoStage } from "./video-stage";
import { ControlDock, DockButton } from "./control-dock";
import { ChatDrawer, useChatMessages } from "./chat-drawer";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Button } from "@/components/ui/button";
import type { CallToken, Mode } from "@/hooks/use-call-token";

function CallRoomBody({
  mode,
  partnerName,
  maxParticipants,
  onPartnerLeft,
  onNext,
  onLeave,
}: {
  mode: Mode;
  partnerName: string | null;
  maxParticipants?: number | null;
  onPartnerLeft: () => void;
  onNext?: () => void;
  onLeave: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const participants = useParticipants();
  const remoteParticipants = useRemoteParticipants();
  const hadPartnerRef = useRef(false);
  const { messages, sendMessage } = useChatMessages();

  useEffect(() => {
    if (remoteParticipants.length > 0) {
      hadPartnerRef.current = true;
    } else if (hadPartnerRef.current) {
      onPartnerLeft();
    }
  }, [remoteParticipants.length, onPartnerLeft]);

  const unread = chatOpen ? 0 : Math.max(0, messages.length - lastReadCount);
  const groupChat = remoteParticipants.length > 1;

  function toggleChat() {
    setChatOpen((o) => {
      if (!o) setLastReadCount(messages.length);
      return !o;
    });
  }

  return (
    <div className="relative flex min-h-0 flex-1 sm:gap-4">
      <RoomAudioRenderer />

      {/* Stage with the control dock overlaid at the bottom */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <VideoStage mode={mode} partnerName={partnerName} />
        {maxParticipants ? (
          <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-mist">
              <GroupIcon className="h-3.5 w-3.5" />
              {participants.length}/{maxParticipants}
            </span>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+10px)] sm:pb-5">
          <div className="pointer-events-auto">
            <ControlDock
              mode={mode}
              chatOpen={chatOpen}
              unreadCount={unread}
              onToggleChat={toggleChat}
              onNext={onNext}
              onLeave={onLeave}
            />
          </div>
        </div>
      </div>

      {/* Desktop: chat as a fixed-height side panel */}
      {chatOpen && (
        <div className="hidden h-full min-h-0 w-80 shrink-0 sm:block">
          <ChatDrawer
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={sendMessage}
            showSenders={groupChat}
          />
        </div>
      )}

      {/* Mobile: chat overlays the video as a sheet — never squashes it */}
      {chatOpen && (
        <div className="absolute inset-x-2 top-2 bottom-[calc(env(safe-area-inset-bottom)+78px)] z-30 sm:hidden">
          <ChatDrawer
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={sendMessage}
            showSenders={groupChat}
          />
        </div>
      )}
    </div>
  );
}

export function CallShell({
  mode,
  callToken,
  error,
  partnerName,
  maxParticipants,
  searchLabel,
  onNext,
  onLeave,
  onRetry,
  onPartnerLeft,
  interstitialExtra,
  idleContent,
}: {
  mode: Mode;
  callToken: CallToken | null;
  error: string | null;
  partnerName: string | null;
  /** Room capacity — when set, an "N/max" occupancy badge overlays the stage. */
  maxParticipants?: number | null;
  searchLabel: string;
  onNext?: () => void;
  onLeave: () => void;
  onRetry?: () => void;
  /** Called once when the last remote participant leaves an active call. */
  onPartnerLeft?: () => void;
  /** Extra content (e.g. recent-partner chips) on the call-ended interstitial. */
  interstitialExtra?: React.ReactNode;
  /** Replaces the default "searching" screen while there's no call token. */
  idleContent?: React.ReactNode;
}) {
  const router = useRouter();
  const [partnerLeft, setPartnerLeft] = useState(false);

  // A new (or cleared) token means a new round — clear the stale interstitial
  // (adjust-state-during-render pattern, no effect needed).
  const [prevToken, setPrevToken] = useState<CallToken | null>(callToken);
  if (prevToken !== callToken) {
    setPrevToken(callToken);
    setPartnerLeft(false);
  }

  const handlePartnerLeft = useCallback(() => {
    setPartnerLeft(true);
    onPartnerLeft?.();
  }, [onPartnerLeft]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard strong className="flex max-w-sm flex-col items-center gap-4 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-ink/80" />
          <p className="text-sm text-mist">{error}</p>
          <div className="flex gap-2">
            {onRetry && (
              <Button size="sm" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" /> Try again
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => router.push("/")}>
              Home
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (partnerLeft) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard strong className="flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
          <p className="font-display text-lg font-medium">They left the call</p>
          <p className="text-sm text-mist">You can start a new glimpse whenever you&apos;re ready.</p>
          <div className="flex gap-2">
            {onNext && (
              <Button size="sm" onClick={onNext}>
                Find someone new
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => router.push("/")}>
              Home
            </Button>
          </div>
          {interstitialExtra}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-0 sm:p-6 sm:pt-2">
      {callToken ? (
        <LiveKitRoom
          key={callToken.token}
          token={callToken.token}
          serverUrl={callToken.url}
          connect
          audio
          video={mode === "video"}
          onError={(err) => console.error("[glimpse:livekit]", err)}
          className="contents"
        >
          <CallRoomBody
            mode={mode}
            partnerName={partnerName}
            maxParticipants={maxParticipants}
            onPartnerLeft={handlePartnerLeft}
            onNext={onNext}
            onLeave={onLeave}
          />
        </LiveKitRoom>
      ) : idleContent ? (
        idleContent
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden sm:rounded-[var(--radius-glass-lg)]">
            <GlimpseOrb />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full glass">
                <div className="absolute inset-0 rounded-full animate-pulse-ring" />
                <Loader2 className="h-8 w-8 animate-spin text-ink/70" />
              </div>
              <p className="text-lg font-medium text-mist">{searchLabel}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[calc(env(safe-area-inset-bottom)+10px)] sm:pb-5">
              <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-2.5">
                <DockButton onClick={onLeave} danger label="Cancel">
                  <PhoneOff className="h-5 w-5" />
                </DockButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
