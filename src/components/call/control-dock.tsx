"use client";

import {
  Microphone as Mic,
  MicrophoneMute as MicOff,
  VideoCamera as Video,
  VideoCameraOff as VideoOff,
  Airplay as MonitorUp,
  AirplaySolid as MonitorX,
  ChatBubble as MessageCircle,
  SkipNext as SkipForward,
  PhoneXmark as PhoneOff,
  Community as Rooms,
} from "iconoir-react";
import { useLocalParticipant } from "@livekit/components-react";
import { cn } from "@/lib/utils";
import type { Mode } from "@/hooks/use-call-token";

export function DockButton({
  onClick,
  active,
  danger,
  alert,
  children,
  label,
  className,
}: {
  onClick: () => void;
  /** Feature is on (subtle filled state). `false` = plain idle state. */
  active?: boolean;
  /** White "hang up" style. */
  danger?: boolean;
  /** Danger-tinted state — e.g. mic muted / camera off. Overrides `active`. */
  alert?: boolean;
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={alert ? true : active}
      title={label}
      className={cn(
        "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all active:scale-90 sm:h-[52px] sm:w-[52px]",
        danger
          ? "bg-white text-void hover:bg-white/90"
          : alert
            ? "bg-red-500/85 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] hover:bg-red-500"
            : active
              ? "bg-white/14 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] hover:bg-white/20"
              : "text-mist hover:bg-white/10 hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ControlDock({
  mode,
  chatOpen,
  unreadCount,
  onToggleChat,
  onNext,
  onLeave,
}: {
  mode: Mode;
  chatOpen: boolean;
  unreadCount: number;
  onToggleChat: () => void;
  onNext?: () => void;
  onLeave: () => void;
}) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  return (
    <div className="glass-strong flex max-w-[calc(100vw-16px)] items-center gap-1 rounded-full px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
      <DockButton
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        active={isMicrophoneEnabled}
        alert={!isMicrophoneEnabled}
        label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </DockButton>

      {mode === "video" && (
        <DockButton
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          active={isCameraEnabled}
          alert={!isCameraEnabled}
          label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </DockButton>
      )}

      {mode === "video" && (
        <DockButton
          onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
          active={isScreenShareEnabled}
          label={isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
          className="hidden sm:flex"
        >
          {isScreenShareEnabled ? (
            <MonitorX className="h-5 w-5" />
          ) : (
            <MonitorUp className="h-5 w-5" />
          )}
        </DockButton>
      )}

      <div className="relative">
        <DockButton onClick={onToggleChat} active={chatOpen} label="Toggle chat">
          <MessageCircle className="h-5 w-5" />
        </DockButton>
        {unreadCount > 0 && !chatOpen && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-medium text-void">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>

      <a
        href="/rooms"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Rooms"
        title="Rooms"
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-mist transition-all hover:bg-white/10 hover:text-ink active:scale-95 sm:h-[52px] sm:px-4"
      >
        <Rooms className="h-5 w-5" />
        <span className="hidden md:inline">Rooms</span>
      </a>

      {onNext && (
        <button
          onClick={onNext}
          aria-label="Next"
          title="Next"
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-ink transition-all hover:bg-white/16 active:scale-95 sm:h-[52px] sm:px-5"
        >
          <SkipForward className="h-4 w-4" />
          <span className="hidden sm:inline">Next</span>
        </button>
      )}

      <DockButton onClick={onLeave} danger label="Leave">
        <PhoneOff className="h-5 w-5" />
      </DockButton>
    </div>
  );
}
