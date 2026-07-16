import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/home/navbar";
import { ConfessionThreadView } from "@/components/social/confession-thread-view";

export const metadata: Metadata = {
  title: "Confession",
  description: "An anonymous confession thread on Glimpse.",
};

export default async function ConfessionThreadPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <ConfessionThreadView />
    </div>
  );
}
