import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { DiscoverView } from "@/components/discover/discover-view";

export const metadata: Metadata = {
  title: "Discover people",
  description: "Browse public Glimpse profiles by name or shared interest.",
};

const INITIAL_LIMIT = 30;
const POPULAR_TAG_COUNT = 10;

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  let rows: Array<{
    handle: string;
    name: string;
    bio: string | null;
    tags: string;
    avatarWebpBase64: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        handle: users.handle,
        name: users.name,
        bio: users.bio,
        tags: users.tags,
        avatarWebpBase64: users.avatarWebpBase64,
      })
      .from(users)
      .where(eq(users.isPublic, true))
      .limit(INITIAL_LIMIT);
  } catch {
    // Database unreachable or not migrated yet — show an empty directory
    // instead of a 500.
  }

  const initialResults = rows
    .filter((row) => row.handle !== session.user.handle)
    .map((row) => ({ ...row, tags: JSON.parse(row.tags || "[]") as string[] }));

  const tagCounts = new Map<string, number>();
  for (const row of initialResults) {
    for (const tag of row.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, POPULAR_TAG_COUNT)
    .map(([tag]) => tag);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1">
        <GlimpseOrb className="-z-10" />
        <DiscoverView initialResults={initialResults} popularTags={popularTags} />
      </main>
    </div>
  );
}
