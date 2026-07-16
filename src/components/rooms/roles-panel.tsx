"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash as Trash2 } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROOM_PERMISSIONS, type RoomPermission } from "@/lib/permissions";
import type { RoomRoleInfo } from "./types";

const PERMISSION_LABELS: Record<RoomPermission, string> = {
  manage_room: "Manage room",
  manage_roles: "Manage roles",
  manage_members: "Manage members",
  manage_messages: "Delete others' messages",
  invite: "Create invites",
  send_media: "Send media",
};

export function RolesPanel({
  slug,
  roles,
  onChanged,
}: {
  slug: string;
  roles: RoomRoleInfo[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#d4d4d4");
  const [permissions, setPermissions] = useState<RoomPermission[]>([]);
  const [creating, setCreating] = useState(false);

  function togglePermission(p: RoomPermission) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function createRole() {
    if (name.trim().length < 1) {
      toast.error("Give the role a name.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/chatrooms/${slug}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, permissions, position: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create that role.");
        return;
      }
      toast.success("Role created.");
      setName("");
      setPermissions([]);
      onChanged();
    } finally {
      setCreating(false);
    }
  }

  async function deleteRole(roleId: string) {
    const res = await fetch(`/api/chatrooms/${slug}/roles/${roleId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't delete that role.");
      return;
    }
    onChanged();
  }

  async function updateRolePermissions(role: RoomRoleInfo, next: RoomPermission[]) {
    const res = await fetch(`/api/chatrooms/${slug}/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't update that role.");
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="rounded-2xl glass p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: role.color ?? "var(--ink)" }}>
                {role.name}
              </span>
              {role.name !== "Owner" && !role.isDefault ? (
                <button
                  onClick={() => deleteRole(role.id)}
                  className="rounded-full p-1.5 text-mist-dim hover:bg-white/10 hover:text-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {role.name === "Owner" ? (
              <p className="text-xs text-mist-dim">Has every permission. Can&apos;t be edited.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {ROOM_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs text-mist">
                    <input
                      type="checkbox"
                      checked={role.permissions.includes(p)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...role.permissions, p]
                          : role.permissions.filter((x) => x !== p);
                        updateRolePermissions(role, next);
                      }}
                      className="accent-white"
                    />
                    {PERMISSION_LABELS[p]}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 pt-4">
        <p className="mb-3 text-sm font-medium text-ink">New role</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name" maxLength={30} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-12 w-12 shrink-0 cursor-pointer rounded-2xl bg-transparent"
            />
          </div>
          <div>
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROOM_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs text-mist">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePermission(p)}
                    className="accent-white"
                  />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={createRole} disabled={creating}>
            <Plus className="h-4 w-4" />
            Create role
          </Button>
        </div>
      </div>
    </div>
  );
}
