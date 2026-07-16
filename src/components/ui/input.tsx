import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "glass flex h-12 w-full rounded-2xl px-4 text-[15px] text-ink placeholder:text-mist-dim",
          "outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-white/30",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
