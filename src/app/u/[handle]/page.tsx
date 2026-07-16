import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { absoluteUrl } from "@/lib/site";
import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { Avatar } from "@/components/ui/avatar";
import { RichBio } from "@/components/profile/rich-bio";
import { ShareProfileDialog } from "@/components/profile/share-profile-dialog";
import { ConfessDialog } from "@/components/profile/confess-dialog";
import { ProfileSocial } from "@/components/social/profile-social";
import { UserPosts } from "@/components/posts/user-posts";

async function getProfileUser(handle: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.handle, handle));
    return user ?? null;
  } catch {
    // Database unreachable or not migrated yet — treat as not found
    // rather than crashing the page.
    return null;
  }
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

async function loadVisibleProfile(handle: string) {
  const user = await getProfileUser(handle);
  if (!user) return null;

  if (!user.isPublic) {
    const session = await auth();
    if (session?.user?.id !== user.id) return null;
  }

  return user;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const user = await loadVisibleProfile(handle);

  if (!user) {
    return { title: "Profile not found" };
  }

  const url = absoluteUrl(`/u/${user.handle}`);
  const description =
    user.bio?.trim() || `${user.name} is on Glimpse — @${user.handle}.`;
  const title = `${user.name} (@${user.handle})`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      siteName: "Glimpse",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const user = await loadVisibleProfile(handle);

  if (!user) notFound();

  const session = await auth();
  const tags = parseTags(user.tags);
  const profileUrl = absoluteUrl(`/u/${user.handle}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: user.createdAt.toISOString(),
    mainEntity: {
      "@type": "Person",
      name: user.name,
      alternateName: `@${user.handle}`,
      description: user.bio ?? undefined,
      url: profileUrl,
      ...(tags.length ? { knowsAbout: tags } : {}),
    },
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          {/* Profile card: fixed on desktop while posts scroll. */}
          <GlassCard
            strong
            className="w-full p-6 sm:p-8 lg:sticky lg:top-6"
          >
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left lg:flex-col lg:items-center lg:text-center">
            <Avatar
              src={user.avatarWebpBase64}
              name={user.name}
              size={84}
              hue={(user.handle.charCodeAt(0) * 37) % 360}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start lg:justify-center">
                <h1 className="font-display text-xl font-medium sm:text-2xl">
                  {user.name}
                </h1>
                <p className="text-sm text-mist-dim">@{user.handle}</p>
              </div>

              {/* Renders follower/following counts + follow/message actions. */}
              <div className="sm:[&>div]:items-start lg:[&>div]:items-center">
                <ProfileSocial
                  userId={user.id}
                  isOwn={session?.user?.id === user.id}
                  signedIn={Boolean(session?.user)}
                />
              </div>

              {user.bio ? (
                <RichBio
                  text={user.bio}
                  className="mt-4 text-sm leading-relaxed text-mist"
                />
              ) : null}

              {tags.length ? (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start lg:justify-center">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="glass rounded-[var(--radius-pill)] px-2.5 py-1 text-xs text-mist"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start lg:justify-center">
                <ShareProfileDialog
                  url={profileUrl}
                  name={user.name}
                  handle={user.handle}
                />
                <ConfessDialog handle={user.handle} name={user.name} />
              </div>
            </div>
          </div>
          </GlassCard>

          <UserPosts handle={user.handle} className="w-full min-w-0" />
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
