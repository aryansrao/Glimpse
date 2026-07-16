import "server-only";
import { auth } from "@/auth";
import { getOrCreateGuestIdentity } from "@/lib/guest-session";

export type CallerIdentity = {
  id: string;
  name: string;
  avatarWebpBase64: string | null;
  isGuest: boolean;
};

export async function resolveIdentity(): Promise<CallerIdentity> {
  const session = await auth();
  if (session?.user) {
    return {
      id: session.user.id,
      name: session.user.name ?? "Member",
      avatarWebpBase64: session.user.avatarWebpBase64 ?? null,
      isGuest: false,
    };
  }
  const guest = await getOrCreateGuestIdentity();
  return { id: guest.id, name: guest.name, avatarWebpBase64: null, isGuest: true };
}
