import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRooms } from "@/db/schema";
import { absoluteUrl } from "@/lib/site";

async function getPublicRoom(slug: string) {
  try {
    const [room] = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.slug, slug));
    return room && room.visibility === "public" ? room : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = await getPublicRoom(slug);

  // Private/unknown rooms keep a generic, non-leaking title.
  if (!room) return { title: "Room", robots: { index: false } };

  const url = absoluteUrl(`/rooms/${room.slug}`);
  const description =
    room.topic?.trim() ||
    room.description?.trim() ||
    `Join the ${room.name} chatroom on Glimpse.`;

  return {
    title: `${room.name} — chatroom`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: room.name,
      description,
      url,
      type: "website",
      siteName: "Glimpse",
    },
    twitter: { card: "summary_large_image", title: room.name, description },
  };
}

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getPublicRoom(slug);

  let tags: string[] = [];
  if (room) {
    try {
      const parsed = JSON.parse(room.tags);
      if (Array.isArray(parsed)) tags = parsed;
    } catch {}
  }

  const jsonLd = room
    ? {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: room.name,
        about: room.topic ?? undefined,
        description: room.description ?? undefined,
        keywords: tags.join(", ") || undefined,
        url: absoluteUrl(`/rooms/${room.slug}`),
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/JoinAction",
          userInteractionCount: room.memberCount,
        },
      }
    : null;

  return (
    <>
      {children}
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
    </>
  );
}
