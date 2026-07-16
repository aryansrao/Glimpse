"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshDouble as Loader2, Search, Sparks, Xmark as X } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { GlassCard } from "@/components/glass/glass-card";
import { Input } from "@/components/ui/input";
import { FollowButton } from "@/components/social/follow-button";

type Person = {
  /** Present once the API includes ids — enables follow buttons. */
  id?: string;
  handle: string;
  name: string;
  bio: string | null;
  tags: string[];
  avatarWebpBase64: string | null;
  /** Tags shared with the viewer, returned with ?similar=1 results. */
  sharedTags?: string[];
};

export function DiscoverView({
  initialResults,
  popularTags,
}: {
  initialResults: Person[];
  popularTags: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [similarOnly, setSimilarOnly] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("similar") === "1";
    }
    return false;
  });
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (!query && !activeTag && !similarOnly) {
        setResults(initialResults);
        return;
      }
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTag) params.set("tag", activeTag);
      if (similarOnly) params.set("similar", "1");
      fetch(`/api/discover?${params.toString()}`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) {
            toast.error("Couldn't load people right now.");
            return { results: [] };
          }
          return r.json();
        })
        .then((data) => setResults(data.results ?? []))
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            toast.error("Couldn't load people right now.");
          }
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, activeTag, similarOnly, initialResults]);

  const emptyState = useMemo(
    () => !loading && results.length === 0,
    [loading, results]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-medium">Discover people</h1>
      <p className="mt-2 text-mist">Browse public Glimpse profiles by name or interest.</p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, handle, or bio…"
          className="pl-11"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSimilarOnly((s) => !s)}
          className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors ${
            similarOnly ? "bg-white/90 text-void" : "glass text-mist hover:bg-white/10"
          }`}
          aria-pressed={similarOnly}
        >
          <Sparks className="h-3 w-3" />
          People like you
          {similarOnly ? <X className="h-3 w-3" /> : null}
        </button>
      </div>

      {popularTags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const active = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(active ? null : tag)}
                className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-white/90 text-void" : "glass text-mist hover:bg-white/10"
                }`}
              >
                {tag}
                {active ? <X className="ml-1 inline h-3 w-3" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {results.map((person) => (
          <Link key={person.handle} href={`/u/${person.handle}`}>
            <GlassCard className="flex h-full items-start gap-4 p-5 transition-colors hover:bg-white/10">
              <Avatar src={person.avatarWebpBase64} name={person.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{person.name}</p>
                    <p className="text-xs text-mist-dim">@{person.handle}</p>
                  </div>
                  {person.id ? <FollowButton userId={person.id} size="xs" /> : null}
                </div>
                {person.sharedTags?.length ? (
                  <p className="mt-1.5 text-[11px] text-mist">
                    {person.sharedTags.length} shared interest
                    {person.sharedTags.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                {person.bio ? (
                  <p className="mt-2 line-clamp-2 text-sm text-mist">{person.bio}</p>
                ) : null}
                {person.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {person.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[var(--radius-pill)] bg-white/5 px-2 py-0.5 text-[11px] text-mist-dim"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink/70" />
        </div>
      ) : null}

      {emptyState ? (
        <p className="mt-10 text-center text-sm text-mist-dim">
          No one matches yet — try a different search or tag.
        </p>
      ) : null}
    </div>
  );
}
