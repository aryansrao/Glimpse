import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/** Registered users — created via OAuth (Discord / GitHub) sign-in. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    name: text("name").notNull(),
    /** Unique public URL slug, e.g. glimpse.app/u/<handle>. */
    handle: text("handle").notNull(),
    bio: text("bio"),
    /** JSON-encoded string[] of interest tags for discovery/matching. */
    tags: text("tags").notNull().default("[]"),
    avatarWebpBase64: text("avatar_webp_base64"),
    discordId: text("discord_id"),
    githubId: text("github_id"),
    /** bcrypt hash — set only for accounts created with username/password. */
    passwordHash: text("password_hash"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_handle_idx").on(table.handle),
    uniqueIndex("users_discord_id_idx").on(table.discordId),
    uniqueIndex("users_github_id_idx").on(table.githubId),
  ]
);

/**
 * Ad-hoc private 1:1 rooms that a host creates and shares a 6-character
 * code for. Media joins a LiveKit room named `room-<code>`; `hostToken`
 * and `guestPeerId` are opaque nanoid capability tokens (not signalling
 * peer ids) that authorize minting a LiveKit join token for that room.
 */
export const rooms = sqliteTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    mode: text("mode", { enum: ["video", "audio"] })
      .notNull()
      .default("video"),
    hostToken: text("host_token").notNull(),
    hostPeerId: text("host_peer_id").notNull(),
    hostName: text("host_name").notNull(),
    hostUserId: text("host_user_id"),
    guestPeerId: text("guest_peer_id"),
    /** Discord-style room capacity; enforced when minting join tokens. */
    maxParticipants: integer("max_participants").notNull().default(8),
    guestName: text("guest_name"),
    guestUserId: text("guest_user_id"),
    status: text("status", {
      enum: ["waiting", "occupied", "closed"],
    })
      .notNull()
      .default("waiting"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("rooms_status_idx").on(table.status)]
);

/** Random-matchmaking queue for the "random glimpse" flow. */
export const queueEntries = sqliteTable(
  "queue_entries",
  {
    id: text("id").primaryKey(),
    peerId: text("peer_id").notNull(),
    displayName: text("display_name").notNull(),
    userId: text("user_id"),
    mode: text("mode", { enum: ["video", "audio"] })
      .notNull()
      .default("video"),
    status: text("status", {
      enum: ["waiting", "matched", "cancelled"],
    })
      .notNull()
      .default("waiting"),
    matchedWithPeerId: text("matched_with_peer_id"),
    matchedWithName: text("matched_with_name"),
    isInitiator: integer("is_initiator", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Desired call size (2-4). Matching only pairs entries with equal sizes. */
    groupSize: integer("group_size").notNull().default(2),
    /** JSON string[] of the user's interest tags, for similarity-preferred matching. */
    tags: text("tags").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("queue_status_mode_idx").on(table.status, table.mode)]
);

/**
 * Persistent chatrooms — the Discord-like layer. `visibility` "public"
 * rooms are topic-based and discoverable/searchable by anyone;
 * "private" rooms require an invite and membership, and are limited to
 * signed-in users only.
 */
export const chatRooms = sqliteTable(
  "chat_rooms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    topic: text("topic"),
    /** JSON-encoded string[] of tags, used for discovery/search & SEO. */
    tags: text("tags").notNull().default("[]"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    ownerUserId: text("owner_user_id").notNull(),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("chat_rooms_slug_idx").on(table.slug),
    index("chat_rooms_visibility_idx").on(table.visibility),
  ]
);

/**
 * Custom roles per room — Discord-style. `permissions` is a
 * JSON-encoded string[] drawn from a fixed permission set (see
 * lib/permissions.ts): manage_room, manage_roles, manage_members,
 * manage_messages, invite, send_media.
 */
export const roomRoles = sqliteTable(
  "room_roles",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    permissions: text("permissions").notNull().default("[]"),
    position: integer("position").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("room_roles_room_idx").on(table.roomId)]
);

/** Membership of a user in a persistent chatroom, with an assigned role. */
export const roomMembers = sqliteTable(
  "room_members",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id"),
    isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("room_members_room_user_idx").on(table.roomId, table.userId),
    index("room_members_user_idx").on(table.userId),
  ]
);

/** Chat messages inside a persistent chatroom — text and/or media. */
export const roomMessages = sqliteTable(
  "room_messages",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    body: text("body"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type", { enum: ["image", "video", "file"] }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("room_messages_room_idx").on(table.roomId, table.createdAt)]
);

/**
 * Time/use-limited invite tokens for private chatrooms — generated by a
 * member with the `invite` permission, redeemed via the join route.
 */
export const roomInvites = sqliteTable(
  "room_invites",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    code: text("code").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("room_invites_code_idx").on(table.code),
    index("room_invites_room_idx").on(table.roomId),
  ]
);

/** Follow edges — Instagram-style. A "friend" is a mutual follow. */
export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id").notNull(),
    followingId: text("following_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("follows_pair_idx").on(table.followerId, table.followingId),
    index("follows_following_idx").on(table.followingId),
  ]
);

/** 24-hour stories. Read paths must filter on expiresAt > now. */
export const stories = sqliteTable(
  "stories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** Vercel Blob URL (preferred) or a compressed WebP data URL fallback. */
    mediaUrl: text("media_url").notNull(),
    /** "text" stories store their content in caption; mediaUrl is "text:". */
    mediaType: text("media_type", { enum: ["image", "video", "text", "pdf"] })
      .notNull()
      .default("image"),
    caption: text("caption"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("stories_user_idx").on(table.userId),
    index("stories_expires_idx").on(table.expiresAt),
  ]
);

/** Story view receipts, so the rail can dim already-seen rings. */
export const storyViews = sqliteTable(
  "story_views",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id").notNull(),
    viewerId: text("viewer_id").notNull(),
    viewedAt: integer("viewed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("story_views_pair_idx").on(table.storyId, table.viewerId)]
);

/**
 * Direct-message threads between exactly two users. Messages reuse
 * dmMessages below; thread is created lazily on first message.
 */
export const dmThreads = sqliteTable(
  "dm_threads",
  {
    id: text("id").primaryKey(),
    /** Lower user id lexicographically — with userB forms a unique pair. */
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    /**
     * "accepted" = normal DM. "request" = initiated by someone the
     * recipient doesn't follow; sits in the Requests tab until the
     * recipient replies or accepts.
     */
    state: text("state", { enum: ["accepted", "request"] })
      .notNull()
      .default("accepted"),
    /** Who started the thread — the other side is the request recipient. */
    initiatorId: text("initiator_id"),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("dm_threads_pair_idx").on(table.userAId, table.userBId),
    index("dm_threads_user_b_idx").on(table.userBId),
  ]
);

export const dmMessages = sqliteTable(
  "dm_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type", { enum: ["image", "video", "file"] }),
    /** Instagram-style reply reference to another message in this thread. */
    replyToId: text("reply_to_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("dm_messages_thread_idx").on(table.threadId, table.createdAt)]
);

/** One emoji reaction per user per DM message. */
export const dmReactions = sqliteTable(
  "dm_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("dm_reactions_pair_idx").on(table.messageId, table.userId),
    index("dm_reactions_message_idx").on(table.messageId),
  ]
);

/**
 * Finished random-call pairings between signed-in users, so either side
 * can request a rejoin with someone they recently talked to.
 */
export const recentCalls = sqliteTable(
  "recent_calls",
  {
    id: text("id").primaryKey(),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    mode: text("mode", { enum: ["video", "audio"] }).notNull().default("video"),
    endedAt: integer("ended_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("recent_calls_user_a_idx").on(table.userAId, table.endedAt),
    index("recent_calls_user_b_idx").on(table.userBId, table.endedAt),
  ]
);

/** User posts — text and/or media, Instagram-ish. */
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    body: text("body"),
    /** Blob URL or compressed WebP data URL. */
    mediaUrl: text("media_url"),
    mediaType: text("media_type", { enum: ["image", "video"] }),
    /** JSON string[] — #hashtags extracted from body at create time. */
    tags: text("tags").notNull().default("[]"),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("posts_user_idx").on(table.userId, table.createdAt),
    index("posts_created_idx").on(table.createdAt),
  ]
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("post_likes_pair_idx").on(table.postId, table.userId),
    index("post_likes_user_idx").on(table.userId),
  ]
);

export const postComments = sqliteTable(
  "post_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    /** Parent comment id for Reddit-style nested replies; null = top level. */
    parentId: text("parent_id"),
    body: text("body").notNull(),
    /** Denormalized upvotes - downvotes, kept in sync by the vote route. */
    score: integer("score").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("post_comments_post_idx").on(table.postId, table.createdAt),
    index("post_comments_parent_idx").on(table.parentId),
  ]
);

/** One vote per user per comment: +1 or -1. */
export const commentVotes = sqliteTable(
  "comment_votes",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id").notNull(),
    userId: text("user_id").notNull(),
    value: integer("value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("comment_votes_pair_idx").on(table.commentId, table.userId),
  ]
);

/** Ordered media attachments for a post — images, videos, PDFs. */
export const postMedia = sqliteTable(
  "post_media",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    url: text("url").notNull(),
    type: text("type", { enum: ["image", "video", "pdf"] }).notNull(),
    /** Original filename for PDFs/downloads. */
    fileName: text("file_name"),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("post_media_post_idx").on(table.postId, table.position)]
);

/**
 * Anonymous confessions left on a user's profile. Deliberately stores no
 * sender identity — only an hourly-rotating hash for rate limiting.
 */
export const confessions = sqliteTable(
  "confessions",
  {
    id: text("id").primaryKey(),
    toUserId: text("to_user_id").notNull(),
    body: text("body").notNull(),
    /** sha256(ip + hour bucket) — spam control without identifying anyone. */
    senderBucket: text("sender_bucket"),
    /**
     * Set only when the confessor was signed in. NEVER exposed to the
     * recipient — it exists so the confessor can receive anonymous
     * replies in their own Confessions tab.
     */
    senderUserId: text("sender_user_id"),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("confessions_to_user_idx").on(table.toUserId, table.createdAt),
    index("confessions_sender_idx").on(table.senderUserId),
  ]
);

/**
 * Replies within a confession — an anonymous back-and-forth. The
 * recipient always sees the other side as "Anonymous".
 */
export const confessionMessages = sqliteTable(
  "confession_messages",
  {
    id: text("id").primaryKey(),
    confessionId: text("confession_id").notNull(),
    /** true = profile owner (recipient), false = the anonymous confessor. */
    fromOwner: integer("from_owner", { mode: "boolean" }).notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("confession_messages_confession_idx").on(
      table.confessionId,
      table.createdAt
    ),
  ]
);

/** One-time email verification codes (hashed) for OTP verify flows. */
export const emailOtps = sqliteTable(
  "email_otps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("email_otps_user_idx").on(table.userId)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type ChatRoom = typeof chatRooms.$inferSelect;
export type RoomRole = typeof roomRoles.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type RoomMessage = typeof roomMessages.$inferSelect;
export type RoomInvite = typeof roomInvites.$inferSelect;
