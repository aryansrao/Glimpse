"use client";

import Link from "next/link";

const TAG_SPLIT = /(#[\p{L}\p{N}_-]{2,24})/gu;

/** Post body text with #hashtags rendered as links to search. */
export function PostBody({ body, className }: { body: string; className?: string }) {
  const parts = body.split(TAG_SPLIT);

  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith("#") && part.length > 2 ? (
          <Link
            key={`${part}-${i}`}
            href={`/search?q=${encodeURIComponent(part)}`}
            className="text-ink/80 underline-offset-4 transition-colors hover:text-ink hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
