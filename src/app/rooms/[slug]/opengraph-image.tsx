import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRooms } from "@/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Glimpse chatroom";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let name = "Glimpse";
  let topic: string | null = null;
  let members = 0;
  let tags: string[] = [];
  let emojiIcon: string | null = null;

  try {
    const [room] = await db.select().from(chatRooms).where(eq(chatRooms.slug, slug));
    if (room && room.visibility === "public") {
      name = room.name;
      topic = room.topic ?? room.description;
      members = room.memberCount;
      // Only short emoji/text icons render in OG images; skip uploaded ones.
      if (room.icon && !room.icon.startsWith("data:")) emojiIcon = room.icon;
      try {
        const parsed = JSON.parse(room.tags);
        if (Array.isArray(parsed)) tags = parsed.slice(0, 4);
      } catch {}
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#050505",
          color: "#f5f5f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "rgba(255,255,255,0.8)",
            }}
          />
          <div style={{ fontSize: 32, color: "#a8a8a8", letterSpacing: 2 }}>
            Glimpse · chatroom
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 40 }}>
          {emojiIcon ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 110,
                height: 110,
                borderRadius: 28,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                fontSize: 56,
              }}
            >
              {emojiIcon}
            </div>
          ) : null}
          <div style={{ fontSize: 80, fontWeight: 500, display: "flex", maxWidth: 950 }}>
            {name}
          </div>
        </div>
        {topic ? (
          <div
            style={{
              fontSize: 34,
              color: "#c9c9c9",
              marginTop: 26,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            {topic.slice(0, 120)}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 14, marginTop: 36, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              padding: "10px 26px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              fontSize: 28,
              color: "#f5f5f5",
            }}
          >
            {members} member{members === 1 ? "" : "s"}
          </div>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "10px 26px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 28,
                color: "#d4d4d4",
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
