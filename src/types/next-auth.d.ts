import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string;
      /** Boolean flag from our users table — named to avoid clashing with
       * Auth.js's built-in `emailVerified: Date | null` on AdapterUser. */
      isEmailVerified?: boolean;
      avatarWebpBase64?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
