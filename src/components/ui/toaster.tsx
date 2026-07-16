"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "!glass !rounded-[20px] !text-ink !border-0 !font-sans",
          description: "!text-mist",
        },
      }}
    />
  );
}
