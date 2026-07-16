import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Glimpse profile";

export default async function OgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let name = "Glimpse";
  let userHandle: string | null = null;
  let bio: string | null = null;
  let tags: string[] = [];

  try {
    const [user] = await db.select().from(users).where(eq(users.handle, handle));
    if (user?.isPublic) {
      name = user.name;
      userHandle = user.handle;
      bio = user.bio;
      try {
        const parsed = JSON.parse(user.tags);
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
          <div style={{ fontSize: 32, color: "#a8a8a8", letterSpacing: 2 }}>Glimpse</div>
        </div>
        <div style={{ fontSize: 84, fontWeight: 500, marginTop: 40, display: "flex" }}>
          {name}
        </div>
        {userHandle ? (
          <div style={{ fontSize: 40, color: "#a8a8a8", marginTop: 8, display: "flex" }}>
            @{userHandle}
          </div>
        ) : null}
        {bio ? (
          <div
            style={{
              fontSize: 32,
              color: "#c9c9c9",
              marginTop: 28,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            {bio.slice(0, 120)}
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
            {tags.map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  padding: "10px 26px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 28,
                  color: "#d4d4d4",
                }}
              >
                #{tag}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    size
  );
}
