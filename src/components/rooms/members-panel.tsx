"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserXmark as UserX } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { hueFromId } from "@/lib/guest-identity";
import type { RoomMemberInfo, RoomRoleInfo } from "./types";

export function MembersPanel({
  slug,
  members,
  roles,
  canManageMembers,
  canManageRoles,
  onChanged,
}: {
  slug: string;
  members: RoomMemberInfo[];
  roles: RoomRoleInfo[];
  canManageMembers: boolean;
  canManageRoles: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function assignRole(userId: string, roleId: string) {
    setBusy(userId);
    try {
      const res = await fetch(`/api/chatrooms/${slug}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: roleId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't assign that role.");
        return;
      }
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function kick(userId: string) {
    setBusy(userId);
    try {
      const res = await fetch(`/api/chatrooms/${slug}/members/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't remove that member.");
        return;
      }
      toast.success("Member removed.");
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 p-4">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/5">
          <Avatar src={m.avatarWebpBase64} name={m.name} hue={hueFromId(m.userId)} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{m.name}</p>
            {m.role ? (
              <span
                className="text-xs font-medium"
                style={{ color: m.role.color ?? "var(--mist)" }}
              >
                {m.role.name}
              </span>
            ) : m.isOwner ? (
              <span className="text-xs font-medium text-mist">Owner</span>
            ) : (
              <span className="text-xs text-mist-dim">Member</span>
            )}
          </div>

          {!m.isOwner && canManageRoles ? (
            <select
              className="glass rounded-xl bg-transparent px-2 py-1 text-xs text-ink outline-none"
              value={m.role?.id ?? ""}
              disabled={busy === m.userId}
              onChange={(e) => assignRole(m.userId, e.target.value)}
            >
              <option value="">No role</option>
              {roles
                .filter((r) => r.name !== "Owner")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          ) : null}

          {!m.isOwner && canManageMembers ? (
            <button
              onClick={() => kick(m.userId)}
              disabled={busy === m.userId}
              className="rounded-full p-1.5 text-mist-dim transition-colors hover:bg-white/10 hover:text-ink"
              title="Remove from room"
            >
              <UserX className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
