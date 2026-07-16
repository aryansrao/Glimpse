"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { MediaImagePlus, RefreshDouble as Loader2, Xmark as X } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToStoryWebpBase64 } from "./story-image";

export function StoryComposer({
  open,
  onOpenChange,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [posting, setPosting] = useState(false);

  function reset() {
    setPreview(null);
    setCaption("");
    setCompressing(false);
    setPosting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Stories are images for now — pick a photo.");
      return;
    }
    setCompressing(true);
    try {
      const dataUrl = await fileToStoryWebpBase64(file);
      setPreview(dataUrl);
    } catch {
      toast.error("Couldn't read that image. Try a different one.");
    } finally {
      setCompressing(false);
    }
  }

  async function share() {
    if (!preview || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaBase64: preview,
          caption: caption.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" ? data.error : "Couldn't post your story."
        );
        return;
      }
      toast.success("Story shared — it'll fade in 24 hours.");
      onOpenChange(false);
      reset();
      onPosted();
    } catch {
      toast.error("Couldn't post your story. Check your connection.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to your story</DialogTitle>
          <DialogDescription>
            A single frame, gone in 24 hours. Visible to people who follow you.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={compressing}
            className="glass flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl text-mist transition-colors hover:bg-white/10 hover:text-ink"
          >
            {compressing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <MediaImagePlus className="h-8 w-8" />
                <span className="text-sm">Choose a photo</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-3xl bg-void-soft">
              {/* Stories are compressed base64 data URLs — next/image is not applicable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Story preview"
                className="max-h-[46vh] w-full object-contain"
              />
              <button
                onClick={() => {
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute right-3 top-3 rounded-full bg-void/60 p-2 text-ink backdrop-blur-md transition-colors hover:bg-void/80"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              maxLength={140}
              onKeyDown={(e) => e.key === "Enter" && share()}
            />
            <Button onClick={share} disabled={posting} className="w-full">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share story"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
