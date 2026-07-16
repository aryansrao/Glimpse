"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshDouble as Loader2, Settings, Group as Users, Xmark as X } from "iconoir-react";
import { Navbar } from "@/components/home/navbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMessageBubble } from "@/components/rooms/chat-message";
import { Composer } from "@/components/rooms/composer";
import { MembersPanel } from "@/components/rooms/members-panel";
import { RolesPanel } from "@/components/rooms/roles-panel";
import { RoomSettingsPanel } from "@/components/rooms/room-settings-panel";
import { JoinGate } from "@/components/rooms/join-gate";
import { RoomIcon } from "@/components/rooms/room-icon";
import { playMessageSound } from "@/lib/settings-store";
import { hasPermission } from "@/lib/permissions";
import type { ChatMessage, RoomDetail, RoomMemberInfo, RoomRoleInfo, Viewer } from "@/components/rooms/types";

export default function RoomPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const slug = params.slug;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<RoomMemberInfo[]>([]);
  const [roles, setRoles] = useState<RoomRoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialTime] = useState(() => Date.now());
  const lastEventMs = useRef(initialTime);
  const seenIds = useRef<Set<string>>(new Set());

  const loadRoom = useCallback(async () => {
    const res = await fetch(`/api/chatrooms/${slug}`);
    const data = await res.json();
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    setRoom(data.room ?? null);
    setViewer(data.viewer ?? null);
  }, [slug]);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/chatrooms/${slug}/messages?limit=50`);
    if (!res.ok) return;
    const data = await res.json();
    const ordered = [...data.messages].reverse() as ChatMessage[];
    ordered.forEach((m) => seenIds.current.add(m.id));
    setMessages(ordered);
    if (ordered.length) {
      lastEventMs.current = new Date(ordered[ordered.length - 1].createdAt).getTime();
    }
  }, [slug]);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/chatrooms/${slug}/members`);
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members ?? []);
  }, [slug]);

  const loadRoles = useCallback(async () => {
    const res = await fetch(`/api/chatrooms/${slug}/roles`);
    if (!res.ok) return;
    const data = await res.json();
    setRoles(data.roles ?? []);
  }, [slug]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadRoom();
    setLoading(false);
  }, [loadRoom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (viewer?.isMember) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMessages();
      loadMembers();
      loadRoles();
    }
  }, [viewer?.isMember, loadMessages, loadMembers, loadRoles]);

  useEffect(() => {
    if (!viewer?.isMember) return;
    const es = new EventSource(`/api/chatrooms/${slug}/events?since=${lastEventMs.current}`);
    es.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data) as ChatMessage;
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      if (msg.userId !== session?.user?.id) playMessageSound("receive");
    });
    return () => es.close();
  }, [slug, viewer?.isMember, session?.user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleSent() {
    playMessageSound("send");
    loadMessages();
  }

  async function handleDelete(messageId: string) {
    const res = await fetch(`/api/chatrooms/${slug}/messages/${messageId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't delete that message.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  const permissions = viewer?.permissions ?? [];
  const canManageRoom = hasPermission(permissions, "manage_room");
  const canManageRoles = hasPermission(permissions, "manage_roles");
  const canManageMembers = hasPermission(permissions, "manage_members");
  const canSendMedia = hasPermission(permissions, "send_media");
  const canInvite = hasPermission(permissions, "invite");

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6">
          <p className="text-mist">This room doesn&apos;t exist.</p>
        </main>
      </div>
    );
  }

  if (loading || !room) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink/70" />
        </main>
      </div>
    );
  }

  if (!viewer?.isMember) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <JoinGate
            slug={slug}
            visibility={room.visibility}
            initialInviteCode={searchParams.get("invite") ?? undefined}
            onJoined={loadAll}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 gap-4 overflow-hidden px-4 pb-4 sm:px-6">
        <div className="glass flex flex-1 flex-col overflow-hidden rounded-[var(--radius-glass-lg)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/8 text-lg">
                <RoomIcon icon={room.icon} name={room.name} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-display text-base font-medium text-ink">{room.name}</h1>
                {room.topic ? <p className="truncate text-xs text-mist">{room.topic}</p> : null}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelOpen((p) => !p)}
              title="Members & settings"
            >
              {panelOpen ? <X className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-mist-dim">
                No messages yet. Say hello.
              </p>
            ) : (
              messages.map((m) => (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  isOwn={m.userId === session?.user?.id}
                  canDelete={m.userId === session?.user?.id || hasPermission(permissions, "manage_messages")}
                  onDelete={() => handleDelete(m.id)}
                />
              ))
            )}
          </div>

          <Composer slug={slug} canSendMedia={canSendMedia} onSent={handleSent} />
        </div>

        {panelOpen ? (
          <div className="glass hidden w-80 shrink-0 flex-col overflow-hidden rounded-[var(--radius-glass-lg)] sm:flex">
            <Tabs defaultValue="members" className="flex h-full flex-col">
              <div className="border-b border-white/5 p-3">
                <TabsList className="w-full justify-between">
                  <TabsTrigger value="members" className="flex-1">
                    Members
                  </TabsTrigger>
                  {canManageRoles ? (
                    <TabsTrigger value="roles" className="flex-1">
                      Roles
                    </TabsTrigger>
                  ) : null}
                  {(canManageRoom || canInvite) ? (
                    <TabsTrigger value="settings" className="flex-1">
                      <Settings className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="members">
                  <MembersPanel
                    slug={slug}
                    members={members}
                    roles={roles}
                    canManageMembers={canManageMembers}
                    canManageRoles={canManageRoles}
                    onChanged={() => {
                      loadMembers();
                    }}
                  />
                </TabsContent>
                {canManageRoles ? (
                  <TabsContent value="roles">
                    <RolesPanel slug={slug} roles={roles} onChanged={loadRoles} />
                  </TabsContent>
                ) : null}
                {(canManageRoom || canInvite) ? (
                  <TabsContent value="settings">
                    <RoomSettingsPanel
                      slug={slug}
                      room={room}
                      canManageRoom={canManageRoom}
                      canInvite={canInvite}
                      onChanged={loadRoom}
                    />
                  </TabsContent>
                ) : null}
              </div>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  );
}
