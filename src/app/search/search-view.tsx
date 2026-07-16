"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshDouble as Loader2, Search as SearchIcon, Xmark } from "iconoir-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserChip } from "@/components/social/user-chip";
import { RoomCard, type RoomSummary } from "@/components/rooms/room-card";
import { PostCard } from "@/components/posts/post-card";
import { toPostViews, type PostView } from "@/components/posts/post-types";

type SearchUser = {
  id?: string;
  handle: string | null;
  name: string;
  avatarWebpBase64: string | null;
};

type Results = {
  users: SearchUser[];
  rooms: RoomSummary[];
  posts: PostView[];
};

type Tab = "all" | "users" | "rooms" | "posts";

function normalizeRooms(raw: unknown): RoomSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        Boolean(r) && typeof r === "object" && typeof (r as Record<string, unknown>).slug === "string"
    )
    .map((r) => ({
      slug: String(r.slug),
      name: typeof r.name === "string" ? r.name : String(r.slug),
      description: typeof r.description === "string" ? r.description : null,
      icon: typeof r.icon === "string" ? r.icon : null,
      topic: typeof r.topic === "string" ? r.topic : null,
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      memberCount: typeof r.memberCount === "number" ? r.memberCount : 0,
    }));
}

function normalizeUsers(raw: unknown): SearchUser[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (u): u is Record<string, unknown> =>
        Boolean(u) && typeof u === "object" && typeof (u as Record<string, unknown>).name === "string"
    )
    .map((u) => ({
      id: typeof u.id === "string" ? u.id : undefined,
      handle: typeof u.handle === "string" ? u.handle : null,
      name: String(u.name),
      avatarWebpBase64: typeof u.avatarWebpBase64 === "string" ? u.avatarWebpBase64 : null,
    }));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-mist-dim">
      {children}
    </h2>
  );
}

export function SearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("all");
  const [results, setResults] = useState<Results | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    const seq = ++requestSeq.current;
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=all`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      setResults({
        users: normalizeUsers(data.users),
        rooms: normalizeRooms(data.rooms),
        posts: toPostViews(data.posts),
      });
    } catch {
      // Search API may not exist yet — show empty results, not a crash.
      if (seq === requestSeq.current) setResults({ users: [], rooms: [], posts: [] });
    } finally {
      if (seq === requestSeq.current) setSearching(false);
    }
  }, []);

  // Debounced search + shareable ?q= URL state.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = query.trim();
      const target = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
      router.replace(target, { scroll: false });
      void runSearch(query);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, router, runSearch]);

  const hasQuery = query.trim().length > 0;
  const empty =
    results !== null &&
    results.users.length === 0 &&
    results.rooms.length === 0 &&
    results.posts.length === 0;

  const showUsers = (tab === "all" || tab === "users") && (results?.users.length ?? 0) > 0;
  const showRooms = (tab === "all" || tab === "rooms") && (results?.rooms.length ?? 0) > 0;
  const showPosts = (tab === "all" || tab === "posts") && (results?.posts.length ?? 0) > 0;
  const tabEmpty =
    results !== null && !empty && !showUsers && !showRooms && !showPosts;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">Search</h1>
      <p className="mt-1 text-sm text-mist">People, rooms, and posts — all in one place.</p>

      <div className="glass-strong mt-6 flex items-center gap-3 rounded-[var(--radius-glass)] px-5 py-1">
        <SearchIcon className="h-5 w-5 shrink-0 text-mist-dim" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Glimpse..."
          className="h-14 w-full bg-transparent text-lg text-ink outline-none placeholder:text-mist-dim"
          aria-label="Search"
        />
        {searching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-mist-dim" />
        ) : query ? (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="cursor-pointer text-mist-dim transition-colors hover:text-ink"
          >
            <Xmark className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-5">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="users">People</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-8 flex flex-col gap-10">
        {!hasQuery ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center">
            <SearchIcon className="h-5 w-5 text-mist-dim" />
            <p className="text-sm text-mist">Type to search.</p>
            <p className="text-xs text-mist-dim">Try a name, a #tag, or a room topic.</p>
          </div>
        ) : results === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass h-16 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : empty || tabEmpty ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center">
            <p className="text-sm text-mist">Nothing found for &ldquo;{query.trim()}&rdquo;.</p>
            <p className="text-xs text-mist-dim">Try a different spelling or fewer words.</p>
          </div>
        ) : (
          <>
            {showUsers ? (
              <section>
                {tab === "all" ? <SectionLabel>People</SectionLabel> : null}
                <div className="flex flex-col gap-2">
                  {results.users.map((u) => (
                    <UserChip key={u.id ?? u.handle ?? u.name} user={u} withFollow />
                  ))}
                </div>
              </section>
            ) : null}

            {showRooms ? (
              <section>
                {tab === "all" ? <SectionLabel>Rooms</SectionLabel> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {results.rooms.map((room) => (
                    <RoomCard key={room.slug} room={room} />
                  ))}
                </div>
              </section>
            ) : null}

            {showPosts ? (
              <section>
                {tab === "all" ? <SectionLabel>Posts</SectionLabel> : null}
                <div className="flex flex-col gap-3">
                  {results.posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
