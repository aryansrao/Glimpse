import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { SearchView } from "./search-view";

export const metadata: Metadata = {
  title: "Search",
  description: "Find people, rooms, and posts on Glimpse.",
};

export default function SearchPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 py-10 sm:py-16">
        <GlimpseOrb className="-z-10" />
        <Suspense fallback={null}>
          <SearchView />
        </Suspense>
      </main>
    </div>
  );
}
