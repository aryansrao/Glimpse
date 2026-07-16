"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  hue = 250,
  size = 44,
  className,
}: {
  src?: string | null;
  name: string;
  hue?: number;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AvatarPrimitive.Root
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        boxShadow:
          "0 0 0 2px rgba(255, 255, 255, 0.22), 0 6px 20px -6px rgba(0, 0, 0, 0.5)",
      }}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center text-sm font-medium text-void"
        style={{
          background: "linear-gradient(135deg, #e8e8e8, #9a9a9a)",
        }}
        delayMs={src ? 400 : 0}
      >
        {initials || "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
