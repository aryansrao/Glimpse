export const ROOM_PERMISSIONS = [
  "manage_room", // rename room, change icon/topic/visibility
  "manage_roles", // create/edit/assign custom roles
  "manage_members", // kick/ban members
  "manage_messages", // delete others' messages
  "invite", // create invite links
  "send_media", // upload images/files in chat
] as const;

export type RoomPermission = (typeof ROOM_PERMISSIONS)[number];

export function hasPermission(
  granted: string[],
  permission: RoomPermission
): boolean {
  return granted.includes(permission);
}

/** Default role granted to everyone who joins a room, no special powers. */
export const DEFAULT_ROLE_PERMISSIONS: RoomPermission[] = ["send_media"];

/** Full permission set assigned to a room's creator (the owner role). */
export const OWNER_ROLE_PERMISSIONS: RoomPermission[] = [...ROOM_PERMISSIONS];
