import * as React from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  strong,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-[var(--radius-glass)]",
        className
      )}
      {...props}
    />
  );
}
