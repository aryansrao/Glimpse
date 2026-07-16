"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, QrCode, ShareIos } from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileQr, type ProfileQrHandle } from "@/components/profile/profile-qr";

type ShareProfileDialogProps = {
  url: string;
  name: string;
  handle: string;
};

/**
 * Compact share sheet for a public profile: QR, copyable URL,
 * PNG download and (where supported) the native share sheet.
 */
export function ShareProfileDialog({ url, name, handle }: ShareProfileDialogProps) {
  const qrRef = useRef<ProfileQrHandle>(null);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Deferred so SSR markup matches the first client render.
    const t = window.setTimeout(() => {
      setCanShare(typeof navigator.share === "function");
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function download() {
    try {
      await qrRef.current?.download();
    } catch {
      toast.error("Couldn't export the QR code.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `${name} on Glimpse`,
        text: `Follow @${handle} on Glimpse`,
        url,
      });
    } catch {
      // User dismissed the sheet — nothing to report.
    }
  }

  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    <Dialog>
      <DialogTrigger className="glass flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink">
        <QrCode className="h-3.5 w-3.5" />
        Share
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader className="mb-4">
          <DialogTitle>Share profile</DialogTitle>
          <DialogDescription>Scan to open @{handle} on Glimpse.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <ProfileQr ref={qrRef} url={url} handle={handle} />
        </div>

        <div className="glass mt-4 flex items-center gap-1 rounded-2xl py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-mist">{displayUrl}</span>
          <button
            type="button"
            aria-label="Copy profile URL"
            onClick={copyUrl}
            className="cursor-pointer rounded-full p-2 text-mist transition-colors hover:bg-white/10 hover:text-ink"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={download}
            className="glass flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink"
          >
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={share}
              className="glass flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-ink"
            >
              <ShareIos className="h-3.5 w-3.5" />
              Share
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
