import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { DmHub } from "@/components/social/dm-hub";

export const metadata: Metadata = {
  title: "Messages",
  description: "Your direct messages on Glimpse.",
};

export default async function DmsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-medium">Messages</h1>
          <p className="mt-2 text-mist">Quiet conversations, one to one.</p>
          <DmHub className="mt-6" />
        </div>
      </main>
    </div>
  );
}
