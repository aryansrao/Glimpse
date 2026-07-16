"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type QRCodeStyling from "qr-code-styling";
import { cn } from "@/lib/utils";

export type ProfileQrHandle = {
  /** Export the QR as a PNG download. Rejects if the QR isn't ready. */
  download: () => Promise<void>;
};

type ProfileQrProps = {
  url: string;
  /** Used for the downloaded file name. */
  handle?: string;
  className?: string;
  ref?: React.Ref<ProfileQrHandle>;
};

const QR_SIZE = 220;

/**
 * Just the QR: rounded monochrome dots (#f5f5f5) on a solid dark plate
 * (#0a0a0a) so PNG exports stay legible on any background. No center logo.
 * Surrounding context (identity, URL, actions) belongs to the caller.
 */
export function ProfileQr({ url, handle, className, ref }: ProfileQrProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Imported lazily — qr-code-styling touches browser APIs.
      const { default: QRCodeStylingCtor } = await import("qr-code-styling");
      if (cancelled || !holderRef.current) return;

      const qr = new QRCodeStylingCtor({
        width: QR_SIZE,
        height: QR_SIZE,
        type: "svg",
        data: url,
        margin: 12,
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { type: "rounded", color: "#f5f5f5" },
        cornersSquareOptions: { type: "extra-rounded", color: "#f5f5f5" },
        cornersDotOptions: { type: "dot", color: "#f5f5f5" },
        backgroundOptions: { color: "#0a0a0a" },
      });

      holderRef.current.replaceChildren();
      qr.append(holderRef.current);
      qrRef.current = qr;
    })();

    return () => {
      cancelled = true;
      qrRef.current = null;
    };
  }, [url]);

  useImperativeHandle(ref, () => ({
    async download() {
      if (!qrRef.current) throw new Error("QR not ready");
      await qrRef.current.download({
        name: handle ? `glimpse-${handle}` : "glimpse-qr",
        extension: "png",
      });
    },
  }));

  return (
    <div
      ref={holderRef}
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-2xl [&_svg]:h-auto [&_svg]:max-w-full",
        className
      )}
      style={{ minHeight: QR_SIZE, minWidth: QR_SIZE }}
      aria-label="Profile QR code"
      role="img"
    />
  );
}
