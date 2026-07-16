import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/home/navbar";
import { DmThreadView } from "@/components/social/dm-thread-view";

export const metadata: Metadata = {
  title: "Conversation",
  description: "A direct message thread on Glimpse.",
};

export default async function DmThreadPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <DmThreadView />
    </div>
  );
}
