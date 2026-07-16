import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRooms, users } from "@/db/schema";
import { absoluteUrl } from "@/lib/site";

const MAX_PROFILE_URLS = 5000;
const MAX_ROOM_URLS = 2000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/sign-in"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/discover"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];

  let profileRoutes: MetadataRoute.Sitemap = [];
  try {
    const publicUsers = await db
      .select({ handle: users.handle, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.isPublic, true))
      .limit(MAX_PROFILE_URLS);

    profileRoutes = publicUsers.map((user) => ({
      url: absoluteUrl(`/u/${user.handle}`),
      lastModified: user.createdAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    // DB not reachable/migrated yet (e.g. build time with no Turso configured) —
    // ship static routes rather than failing the whole build.
  }

  let roomRoutes: MetadataRoute.Sitemap = [];
  try {
    const publicRooms = await db
      .select({ slug: chatRooms.slug, createdAt: chatRooms.createdAt })
      .from(chatRooms)
      .where(eq(chatRooms.visibility, "public"))
      .limit(MAX_ROOM_URLS);

    roomRoutes = publicRooms.map((room) => ({
      url: absoluteUrl(`/rooms/${room.slug}`),
      lastModified: room.createdAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch {
    // Same graceful fallback as profiles.
  }

  return [...staticRoutes, ...profileRoutes, ...roomRoutes];
}
