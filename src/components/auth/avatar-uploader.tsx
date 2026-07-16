"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshDouble as Loader2, Trash as Trash2, Upload } from "iconoir-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fileToAvatarWebpBase64 } from "@/lib/avatar-image";

export function AvatarUploader() {
  const { data: session, update } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const base64 = await fileToAvatarWebpBase64(file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarWebpBase64: base64 }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Couldn't save that avatar.");
        return;
      }
      await update({ avatarWebpBase64: base64 });
      toast.success("Avatar updated.");
    } catch {
      toast.error("Couldn't process that image.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch("/api/profile/avatar", { method: "DELETE" });
      await update({ avatarWebpBase64: null });
      toast.success("Avatar removed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar
        src={session?.user?.avatarWebpBase64}
        name={session?.user?.name ?? "You"}
        size={72}
      />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload photo
        </Button>
        {session?.user?.avatarWebpBase64 && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={loading}>
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
        <p className="text-xs text-mist-dim">Resized and compressed to WebP automatically.</p>
      </div>
    </div>
  );
}
