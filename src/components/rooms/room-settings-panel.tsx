"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshDouble as Loader2 } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoomDetail } from "./types";

export function RoomSettingsPanel({
  slug,
  room,
  canManageRoom,
  canInvite,
  onChanged,
}: {
  slug: string;
  room: RoomDetail;
  canManageRoom: boolean;
  canInvite: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [icon, setIcon] = useState(room.icon ?? "");
  const [topic, setTopic] = useState(room.topic ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/chatrooms/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, topic, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't update the room.");
        return;
      }
      toast.success("Room updated.");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function createInvite() {
    setCreatingInvite(true);
    try {
      const res = await fetch(`/api/chatrooms/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: 168 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create an invite.");
        return;
      }
      const url = `${window.location.origin}/rooms/${slug}?invite=${data.invite.code}`;
      setInvite(url);
    } finally {
      setCreatingInvite(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      {canManageRoom ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="w-16 text-center"
            />
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="flex-1" />
          </div>
          <div>
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </div>
          <Button size="sm" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      ) : null}

      {canInvite && room.visibility === "private" ? (
        <div className="border-t border-white/5 pt-4">
          <p className="mb-2 text-sm font-medium text-ink">Invite link</p>
          <Button size="sm" variant="secondary" className="w-full" onClick={createInvite} disabled={creatingInvite}>
            {creatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate invite (7 days)
          </Button>
          {invite ? (
            <div className="mt-2 flex items-center gap-2 rounded-2xl glass px-3 py-2">
              <span className="flex-1 truncate text-xs text-mist">{invite}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invite);
                  toast.success("Copied.");
                }}
                className="rounded-full p-1.5 text-mist-dim hover:bg-white/10 hover:text-ink"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
