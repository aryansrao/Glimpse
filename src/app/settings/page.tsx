"use client";

import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettingsStore, playMessageSound } from "@/lib/settings-store";

export default function SettingsPage() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex flex-1 items-start justify-center px-6 py-10 sm:py-16">
        <GlassCard strong className="w-full max-w-lg p-8">
          <h1 className="mb-6 font-display text-2xl font-medium">Settings</h1>

          <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-6">
            <div>
              <Label className="mb-0.5 block text-ink">Message sound feedback</Label>
              <p className="text-xs text-mist-dim">
                Play a short blip when sending or receiving chatroom messages.
              </p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={(checked) => {
                setSoundEnabled(checked);
                if (checked) playMessageSound("receive");
              }}
            />
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
