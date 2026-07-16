import Link from "next/link";
import { Group as Users } from "iconoir-react";
import { GlassCard } from "@/components/glass/glass-card";
import { RoomIcon } from "@/components/rooms/room-icon";

export type RoomSummary = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  topic: string | null;
  tags: string[];
  memberCount: number;
};

export function RoomCard({ room }: { room: RoomSummary }) {
  return (
    <Link href={`/rooms/${room.slug}`}>
      <GlassCard className="group h-full p-5 transition-all hover:bg-white/10 hover:-translate-y-0.5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/8 text-xl">
            <RoomIcon icon={room.icon} name={room.name} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-medium text-ink">{room.name}</h3>
            {room.topic ? (
              <p className="truncate text-sm text-mist">{room.topic}</p>
            ) : null}
          </div>
        </div>

        {room.description ? (
          <p className="mt-3 line-clamp-2 text-sm text-mist-dim">{room.description}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {room.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-mist-dim"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs text-mist-dim">
            <Users className="h-3.5 w-3.5" />
            {room.memberCount}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
