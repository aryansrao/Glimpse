/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Renders a chatroom icon: an uploaded image (WebP data URL) when present,
 * otherwise the emoji/text icon, otherwise the room's first letter.
 */
export function RoomIcon({
  icon,
  name,
  className,
}: {
  icon: string | null;
  name: string;
  className?: string;
}) {
  if (icon?.startsWith("data:image/")) {
    return (
      <img
        src={icon}
        alt=""
        className={cn("h-full w-full rounded-[inherit] object-cover", className)}
      />
    );
  }
  return <>{icon || name[0]?.toUpperCase() || "#"}</>;
}
