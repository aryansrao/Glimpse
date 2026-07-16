import { Trash as Trash2 } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { hueFromId } from "@/lib/guest-identity";
import type { ChatMessage } from "./types";

export function ChatMessageBubble({
  message,
  isOwn,
  canDelete,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`group flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn ? (
        <Avatar
          src={message.sender.avatarWebpBase64}
          name={message.sender.name}
          hue={hueFromId(message.userId)}
          size={28}
          className="mb-1 shrink-0"
        />
      ) : null}

      <div className={`flex max-w-[75%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn ? <span className="mb-1 px-1 text-xs text-mist-dim">{message.sender.name}</span> : null}

        <div className="flex items-center gap-1.5">
          {canDelete ? (
            <button
              onClick={onDelete}
              className="hidden rounded-full p-1.5 text-mist-dim opacity-0 transition-opacity hover:bg-white/10 hover:text-ink group-hover:opacity-100 sm:block"
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <div
            className={`rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
              isOwn
                ? "bg-white text-void"
                : "glass text-ink"
            }`}
          >
            {message.mediaType === "image" && message.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.mediaUrl}
                alt="attachment"
                className="mb-1 max-h-64 max-w-full rounded-2xl object-cover"
              />
            ) : message.mediaType === "video" && message.mediaUrl ? (
              <video src={message.mediaUrl} controls className="mb-1 max-h-64 max-w-full rounded-2xl" />
            ) : message.mediaType === "file" && message.mediaUrl ? (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className={`mb-1 block underline ${isOwn ? "text-void" : "text-ink/80"}`}
              >
                Attachment
              </a>
            ) : null}
            {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
          </div>
        </div>

        <span className="mt-1 px-1 text-[11px] text-mist-dim">{time}</span>
      </div>
    </div>
  );
}
