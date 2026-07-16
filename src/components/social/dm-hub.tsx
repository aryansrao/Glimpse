"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Check,
  ChatBubbleEmpty,
  ChatLines,
  MaskSquare,
  MediaImage,
  RefreshDouble as Loader2,
  Search,
  Xmark,
} from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { timeAgo, type DmThread, type SocialUser } from "./social-types";

type SearchPerson = SocialUser & { threadId: string | null };

type SearchMessageHit = {
  threadId: string;
  messageId: string;
  body: string;
  otherUser: SocialUser;
  createdAt: string;
};

type ReceivedConfession = {
  id: string;
  body: string;
  createdAt: string;
  lastMessageAt: string | null;
  replyCount: number;
};

type SentConfession = ReceivedConfession & { toUser: SocialUser };

/** Absolute timestamp for confessions, e.g. "Jul 13, 4:52 PM". */
function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Messages hub: Chats (with search), Requests, and Confessions tabs. */
export function DmHub({ className }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [threads, setThreads] = useState<DmThread[] | null>(null);
  const [requests, setRequests] = useState<DmThread[] | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [received, setReceived] = useState<ReceivedConfession[] | null>(null);
  const [sent, setSent] = useState<SentConfession[] | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{
    people: SearchPerson[];
    messages: SearchMessageHit[];
  } | null>(null);
  const searchSeq = useRef(0);

  const loadThreads = useCallback(async () => {
    try {
      const [chatsRes, requestsRes] = await Promise.all([
        fetch("/api/dms"),
        fetch("/api/dms?state=request"),
      ]);
      if (chatsRes.ok) {
        const data = await chatsRes.json();
        setThreads(Array.isArray(data.threads) ? data.threads : []);
        if (typeof data.requestCount === "number") setRequestCount(data.requestCount);
      } else {
        setThreads([]);
      }
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(Array.isArray(data.threads) ? data.threads : []);
        if (typeof data.requestCount === "number") setRequestCount(data.requestCount);
      } else {
        setRequests([]);
      }
    } catch {
      setThreads((t) => t ?? []);
      setRequests((r) => r ?? []);
      toast.error("Couldn't load your messages.");
    }
  }, []);

  const loadConfessions = useCallback(async () => {
    try {
      const [receivedRes, sentRes] = await Promise.all([
        fetch("/api/confessions"),
        fetch("/api/confessions/sent"),
      ]);
      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReceived(Array.isArray(data.confessions) ? data.confessions : []);
      } else {
        setReceived([]);
      }
      if (sentRes.ok) {
        const data = await sentRes.json();
        setSent(Array.isArray(data.confessions) ? data.confessions : []);
      } else {
        setSent([]);
      }
    } catch {
      setReceived((r) => r ?? []);
      setSent((s) => s ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThreads();
    loadConfessions();
  }, [loadThreads, loadConfessions]);

  // Debounced search (300ms).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dms/search?q=${encodeURIComponent(q)}`);
        if (seq !== searchSeq.current) return;
        if (!res.ok) {
          setResults({ people: [], messages: [] });
          return;
        }
        const data = await res.json();
        setResults({
          people: Array.isArray(data.people) ? data.people : [],
          messages: Array.isArray(data.messages) ? data.messages : [],
        });
      } catch {
        if (seq === searchSeq.current) setResults({ people: [], messages: [] });
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function openPerson(person: SearchPerson) {
    if (person.threadId) {
      router.push(`/dms/${person.threadId}`);
      return;
    }
    try {
      const res = await fetch(`/api/dms/with/${encodeURIComponent(person.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.threadId) {
        toast.error(
          typeof data.error === "string" ? data.error : "Couldn't start that conversation."
        );
        return;
      }
      if (data.pendingApproval) toast("Message request sent");
      router.push(`/dms/${data.threadId}`);
    } catch {
      toast.error("Couldn't start that conversation.");
    }
  }

  async function acceptRequest(thread: DmThread) {
    if (deciding) return;
    setDeciding(thread.threadId);
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(thread.threadId)}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Couldn't accept the request.");
        return;
      }
      setRequests((prev) => (prev ? prev.filter((t) => t.threadId !== thread.threadId) : prev));
      setRequestCount((c) => Math.max(0, c - 1));
      setThreads((prev) => (prev ? [{ ...thread, state: "accepted" }, ...prev] : prev));
      toast.success("Request accepted.");
    } catch {
      toast.error("Couldn't accept the request.");
    } finally {
      setDeciding(null);
    }
  }

  async function declineRequest(thread: DmThread) {
    if (deciding) return;
    setDeciding(thread.threadId);
    try {
      const res = await fetch(`/api/dms/${encodeURIComponent(thread.threadId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Couldn't decline the request.");
        return;
      }
      setRequests((prev) => (prev ? prev.filter((t) => t.threadId !== thread.threadId) : prev));
      setRequestCount((c) => Math.max(0, c - 1));
      toast.success("Request declined.");
    } catch {
      toast.error("Couldn't decline the request.");
    } finally {
      setDeciding(null);
    }
  }

  /* ------------------------------------------------------ renderers */

  function skeleton(rows = 4) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/8" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-full bg-white/8" />
              <div className="h-3 w-40 animate-pulse rounded-full bg-white/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function empty(text: string, hint?: React.ReactNode) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center">
        <ChatBubbleEmpty className="h-6 w-6 text-mist-dim" />
        <p className="text-sm text-mist">{text}</p>
        {hint ? <p className="text-xs text-mist-dim">{hint}</p> : null}
      </div>
    );
  }

  function threadRow(thread: DmThread) {
    const last = thread.lastMessage;
    const mine = last && myId && last.senderId === myId;
    return (
      <Link
        key={thread.threadId}
        href={`/dms/${thread.threadId}`}
        className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
      >
        <Avatar src={thread.otherUser.avatarWebpBase64} name={thread.otherUser.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{thread.otherUser.name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-mist-dim">
            {thread.pendingApproval ? (
              <span className="italic">Request pending</span>
            ) : (
              <>
                {mine ? <span className="shrink-0">You:</span> : null}
                {last ? (
                  last.body ? (
                    <span className="truncate">{last.body}</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <MediaImage className="h-3 w-3" /> Photo
                    </span>
                  )
                ) : (
                  <span className="italic">Say hello</span>
                )}
              </>
            )}
          </p>
        </div>
        {last ? (
          <span className="shrink-0 text-xs text-mist-dim">{timeAgo(last.createdAt)}</span>
        ) : null}
      </Link>
    );
  }

  function confessionRow(c: ReceivedConfession, toUser?: SocialUser) {
    const stamp = c.lastMessageAt ?? c.createdAt;
    return (
      <Link
        key={c.id}
        href={`/dms/confessions/${c.id}`}
        className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
      >
        {toUser ? (
          <Avatar src={toUser.avatarWebpBase64} name={toUser.name} size={44} />
        ) : (
          <span
            aria-hidden
            className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mist"
          >
            <MaskSquare className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {toUser ? (
              <>
                To {toUser.handle ? `@${toUser.handle}` : toUser.name} —{" "}
                <span className="text-mist">anonymous</span>
              </>
            ) : (
              "Anonymous"
            )}
          </p>
          <p className="truncate text-xs text-mist-dim">{c.body}</p>
          <p className="mt-0.5 text-[10px] text-mist-dim">
            {absoluteTime(c.createdAt)} · {timeAgo(stamp)}
            {c.replyCount > 0
              ? ` · ${c.replyCount} ${c.replyCount === 1 ? "reply" : "replies"}`
              : ""}
          </p>
        </div>
      </Link>
    );
  }

  const searchOpen = query.trim().length > 0;

  return (
    <div className={className}>
      <Tabs defaultValue="chats">
        <TabsList>
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            Requests
            {requestCount > 0 ? (
              <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-void">
                {requestCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="confessions">Confessions</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------- Chats */}
        <TabsContent value="chats" className="mt-4 outline-none">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people and messages…"
              className="h-11 rounded-full pl-11 pr-10"
              aria-label="Search people and messages"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-mist-dim transition-colors hover:bg-white/10 hover:text-ink"
                aria-label="Clear search"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {searchOpen ? (
            searching && !results ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-ink/70" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {results?.people.length ? (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-mist-dim">People</p>
                    <div className="flex flex-col gap-2">
                      {results.people.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => openPerson(p)}
                          className="glass flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/10"
                        >
                          <Avatar src={p.avatarWebpBase64} name={p.name} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                            {p.handle ? (
                              <p className="truncate text-xs text-mist-dim">@{p.handle}</p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {results?.messages.length ? (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-mist-dim">Messages</p>
                    <div className="flex flex-col gap-2">
                      {results.messages.map((hit) => (
                        <Link
                          key={hit.messageId}
                          href={`/dms/${hit.threadId}`}
                          className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
                        >
                          <Avatar
                            src={hit.otherUser.avatarWebpBase64}
                            name={hit.otherUser.name}
                            size={40}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {hit.otherUser.name}
                            </p>
                            <p className="truncate text-xs text-mist-dim">{hit.body}</p>
                          </div>
                          <span className="shrink-0 text-xs text-mist-dim">
                            {timeAgo(hit.createdAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                {results && !results.people.length && !results.messages.length && !searching
                  ? empty("Nothing matches that search.")
                  : null}
              </div>
            )
          ) : threads === null ? (
            skeleton()
          ) : threads.length === 0 ? (
            empty(
              "No conversations yet.",
              <>
                Find someone on{" "}
                <Link href="/discover" className="text-mist underline-offset-4 hover:underline">
                  Discover
                </Link>{" "}
                and say hi.
              </>
            )
          ) : (
            <div className="flex flex-col gap-2">{threads.map(threadRow)}</div>
          )}
        </TabsContent>

        {/* ---------------------------------------------- Requests */}
        <TabsContent value="requests" className="mt-4 outline-none">
          {requests === null ? (
            skeleton(2)
          ) : requests.length === 0 ? (
            empty("No message requests.", "Requests from people you don't follow land here.")
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map((thread) => (
                <div
                  key={thread.threadId}
                  className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
                >
                  <Link
                    href={`/dms/${thread.threadId}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar
                      src={thread.otherUser.avatarWebpBase64}
                      name={thread.otherUser.name}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {thread.otherUser.name}
                      </p>
                      <p className="truncate text-xs text-mist-dim">
                        {thread.lastMessage?.body ?? "Wants to message you"}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => acceptRequest(thread)}
                      disabled={deciding === thread.threadId}
                      className="flex cursor-pointer items-center gap-1 rounded-full bg-white/90 px-3.5 py-2 text-xs font-medium text-void transition-all hover:bg-white active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Accept
                    </button>
                    <button
                      onClick={() => declineRequest(thread)}
                      disabled={deciding === thread.threadId}
                      className="glass flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
                    >
                      <Xmark className="h-3 w-3" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------- Confessions */}
        <TabsContent value="confessions" className="mt-4 outline-none">
          {received === null || sent === null ? (
            skeleton(3)
          ) : received.length === 0 && sent.length === 0 ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center">
              <ChatLines className="h-6 w-6 text-mist-dim" />
              <p className="text-sm text-mist">No confessions yet.</p>
              <p className="text-xs text-mist-dim">
                Share your profile to receive some — or leave one on someone else&apos;s.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {received.length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-mist-dim">Received</p>
                  <div className="flex flex-col gap-2">
                    {received.map((c) => confessionRow(c))}
                  </div>
                </div>
              ) : null}
              {sent.length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-mist-dim">Sent</p>
                  <div className="flex flex-col gap-2">
                    {sent.map((c) => confessionRow(c, c.toUser))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
