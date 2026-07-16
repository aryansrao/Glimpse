import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { Navbar } from "@/components/home/navbar";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { PostCard } from "@/components/posts/post-card";
import { toPostView, type PostView } from "@/components/posts/post-types";

async function getPost(id: string): Promise<PostView | null> {
  try {
    const res = await fetch(absoluteUrl(`/api/posts/${encodeURIComponent(id)}`), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return toPostView(data.post ?? data);
  } catch {
    // API not deployed yet or unreachable — treat as not found.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) return { title: "Post not found" };

  const title = post.user.handle ? `Post by @${post.user.handle}` : `Post by ${post.user.name}`;
  const description = post.body
    ? post.body.length > 160
      ? `${post.body.slice(0, 157)}...`
      : post.body
    : `A post by ${post.user.name} on Glimpse.`;
  const url = absoluteUrl(`/p/${post.id}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article", siteName: "Glimpse" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 px-4 py-8 sm:px-6">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto w-full max-w-xl">
          <PostCard post={post} defaultCommentsOpen />
        </div>
      </main>
    </div>
  );
}
