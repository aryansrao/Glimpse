import Link from "next/link";
import { Fragment } from "react";

const TOKEN_RE = /(https?:\/\/[^\s<>"']+|#[\p{L}\p{N}_-]{2,24}|@[a-z0-9_]{3,20})/gu;

/**
 * Renders bio text with URLs, #hashtags and @mentions as links.
 * Plain text otherwise — no HTML injection surface.
 */
export function RichBio({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN_RE);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-ink underline underline-offset-4 hover:text-mist"
            >
              {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          );
        }
        if (part.startsWith("#")) {
          return (
            <Link
              key={i}
              href={`/search?q=${encodeURIComponent(part)}`}
              className="text-ink underline underline-offset-4 hover:text-mist"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("@")) {
          return (
            <Link
              key={i}
              href={`/u/${part.slice(1)}`}
              className="text-ink underline underline-offset-4 hover:text-mist"
            >
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
