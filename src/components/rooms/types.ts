import type { RoomPermission } from "@/lib/permissions";

export type RoomDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  topic: string | null;
  tags: string[];
  visibility: "public" | "private";
  ownerUserId: string;
  memberCount: number;
};

export type Viewer = {
  isMember: boolean;
  isOwner: boolean;
  role?: { id: string; name: string; color: string | null } | null;
  permissions: RoomPermission[];
  requiresInvite?: boolean;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "file" | null;
  createdAt: string;
  sender: { name: string; avatarWebpBase64: string | null };
};

export type RoomRoleInfo = {
  id: string;
  name: string;
  color: string | null;
  permissions: RoomPermission[];
  position: number;
  isDefault: boolean;
};

export type RoomMemberInfo = {
  userId: string;
  isOwner: boolean;
  joinedAt: string;
  name: string;
  handle: string | null;
  avatarWebpBase64: string | null;
  role: RoomRoleInfo | null;
};
