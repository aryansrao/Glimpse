import type { Metadata } from "next";
import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { absoluteUrl } from "@/lib/site";
import { Download, Apple, Windows, Linux } from "iconoir-react";

export const metadata: Metadata = {
  title: "Download Glimpse",
  description: "Download Glimpse for your desktop — macOS, Windows, or Linux.",
  alternates: { canonical: absoluteUrl("/download") },
};

function PlatformCard({
  name,
  icon: Icon,
  formats,
  note,
}: {
  name: string;
  icon: React.ComponentType<{ className: string }>;
  formats: string[];
  note?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
          <Icon className="h-5 w-5 text-ink" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">{name}</h3>
          <p className="text-xs text-mist">{formats.join(", ")}</p>
        </div>
      </div>
      {note && <p className="text-xs text-mist-dim">{note}</p>}
      <a
        href="https://github.com/aryansrao/glimpse/releases/latest"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/20"
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 px-6 py-10 sm:px-10">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-medium">Get Glimpse on your desktop</h1>
            <p className="mt-2 text-sm text-mist">
              Download Glimpse for your platform. Unsigned builds—see platform notes below.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <PlatformCard
              name="macOS"
              icon={Apple}
              formats={[".dmg"]}
              note="Right-click → Open to bypass Gatekeeper on first launch"
            />
            <PlatformCard
              name="Windows"
              icon={Windows}
              formats={[".msi"]}
              note="SmartScreen may block; click &ldquo;Run anyway&rdquo; to proceed"
            />
            <PlatformCard
              name="Linux"
              icon={Linux}
              formats={[".AppImage", ".deb"]}
              note="Choose .AppImage for portability or .deb for your distro"
            />
          </div>

          <GlassCard strong className="mt-8 space-y-4 p-6 sm:p-8">
            <div>
              <h2 className="font-display text-lg font-medium text-ink">About These Builds</h2>
              <p className="mt-2 text-sm text-mist">
                Glimpse Desktop is built with Tauri v2 and loads the web app from{" "}
                <a
                  href="https://glimpse-vc.vercel.app"
                  className="underline hover:text-ink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  glimpse-vc.vercel.app
                </a>
                . Builds are unsigned—your OS may warn you on first launch. This is normal for independent
                apps.
              </p>
            </div>
            <div>
              <h3 className="font-display text-sm font-medium text-ink">Mobile apps coming later</h3>
              <p className="mt-1 text-sm text-mist">
                We&rsquo;re building native iOS and Android apps. Stay tuned.
              </p>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
