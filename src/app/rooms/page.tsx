import Link from "next/link";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Plus, Search } from "iconoir-react";
import { db } from "@/db";
import { chatRooms } from "@/db/schema";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomCard } from "@/components/rooms/room-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chatrooms — join public rooms by topic",
  description:
    "Browse public Glimpse chatrooms by topic, tag, or name — or create your own room with custom roles and invites.",
};

export default async function RoomsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;

  const filters = [eq(chatRooms.visibility, "public")];
  if (q) {
    filters.push(
      or(
        like(chatRooms.name, `%${q}%`),
        like(chatRooms.topic, `%${q}%`),
        like(chatRooms.tags, `%${q}%`)
      )!
    );
  }
  if (tag) filters.push(like(chatRooms.tags, `%"${tag}"%`));

  let rooms: Array<
    Omit<typeof chatRooms.$inferSelect, "tags"> & { tags: string[] }
  > = [];
  try {
    const rows = await db
      .select()
      .from(chatRooms)
      .where(and(...filters))
      .orderBy(desc(chatRooms.memberCount), desc(chatRooms.createdAt))
      .limit(60);

    rooms = rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] }));
  } catch {
    // Database unreachable or not migrated yet — render the empty state
    // instead of a 500 so the page stays usable.
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 py-10 sm:py-16">
        <GlimpseOrb className="-z-10" />

        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-medium text-ink">Rooms</h1>
              <p className="mt-1 text-mist">Persistent chatrooms, open to anyone.</p>
            </div>
            <Button asChild>
              <Link href="/rooms/new">
                <Plus className="h-4 w-4" />
                New room
              </Link>
            </Button>
          </div>

          <form className="mb-8 flex items-center gap-2" action="/rooms">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search by name, topic, or tag..."
                className="pl-11"
              />
            </div>
          </form>

          {rooms.length === 0 ? (
            <p className="py-16 text-center text-mist-dim">
              No rooms found{q ? ` for "${q}"` : ""}. Be the first to create one.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard key={room.slug} room={room} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
