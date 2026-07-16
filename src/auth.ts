import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";

/**
 * The user id of the ALREADY signed-in session during an OAuth callback,
 * if any — this is what makes "Connect Discord/GitHub" on /profile link
 * the provider to the current account instead of creating a new one.
 */
async function currentSessionUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const secureName = "__Secure-authjs.session-token";
    const plainName = "authjs.session-token";
    const salt = store.get(secureName) ? secureName : plainName;
    const raw = store.get(salt)?.value;
    if (!raw || !process.env.AUTH_SECRET) return null;
    const token = await decode({ token: raw, secret: process.env.AUTH_SECRET, salt });
    return typeof token?.uid === "string" ? token.uid : null;
  } catch {
    return null;
  }
}

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    name: "Username and password",
    credentials: {
      username: { label: "Username" },
      password: { label: "Password", type: "password" },
      email: { label: "Email" },
      otp: { label: "OTP" },
    },
    async authorize(credentials) {
      // 1. Check if this is an OTP login
      const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
      const otp = typeof credentials?.otp === "string" ? credentials.otp.trim() : null;

      if (email && otp) {
        // OTP Login / Passwordless magic link verification
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (!user) {
          // If no user exists, verify OTP first and auto-register them
          const [otpRecord] = await db
            .select()
            .from(emailOtps)
            .where(eq(emailOtps.email, email))
            .orderBy(desc(emailOtps.createdAt))
            .limit(1);

          if (!otpRecord) return null;
          if (otpRecord.expiresAt.getTime() < Date.now()) {
            await db.delete(emailOtps).where(eq(emailOtps.id, otpRecord.id));
            return null;
          }
          if (!(await compare(otp, otpRecord.codeHash))) return null;

          const id = nanoid();
          const handle = `${email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")}${nanoid(4)}`;
          const name = email.split("@")[0];

          await db.insert(users).values({
            id,
            email,
            emailVerified: true,
            name,
            handle,
          });
          await db.delete(emailOtps).where(eq(emailOtps.id, otpRecord.id));
          return { id, name, email };
        }

        // Existing user OTP verification
        const [otpRecord] = await db
          .select()
          .from(emailOtps)
          .where(eq(emailOtps.email, email))
          .orderBy(desc(emailOtps.createdAt))
          .limit(1);

        if (!otpRecord) return null;
        if (otpRecord.expiresAt.getTime() < Date.now()) {
          await db.delete(emailOtps).where(eq(emailOtps.id, otpRecord.id));
          return null;
        }
        if (!(await compare(otp, otpRecord.codeHash))) return null;

        await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
        await db.delete(emailOtps).where(eq(emailOtps.id, otpRecord.id));

        return { id: user.id, name: user.name, email: user.email };
      }

      // 2. Otherwise, treat as Username + Password login
      const username = String(credentials?.username ?? "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!username || !password) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.handle, username));
      
      if (!user?.passwordHash) return null;
      if (!(await compare(password, user.passwordHash))) return null;

      // Enforce email verification for password accounts
      if (!user.emailVerified) {
        throw new Error("EmailNotVerified");
      }

      return { id: user.id, name: user.name, email: user.email };
    },
  }),
  Discord({
    clientId: process.env.AUTH_DISCORD_ID,
    clientSecret: process.env.AUTH_DISCORD_SECRET,
  }),
];

// GitHub is wired but only activates once real credentials are set —
// keeps the login page functional without erroring on missing env vars.
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      const provider = account?.provider;
      if (provider !== "discord" && provider !== "github") return true;

      const providerId = String(profile?.id ?? account?.providerAccountId);
      const idColumn = provider === "discord" ? users.discordId : users.githubId;
      // The provider's real email (Discord requires verification before
      // OAuth exposes it; GitHub hands us the primary email) — treat a
      // provider-supplied email as verified.
      const providerEmail = user.email?.trim().toLowerCase() || null;

      const providerPatch =
        provider === "discord" ? { discordId: providerId } : { githubId: providerId };

      const [existing] = await db.select().from(users).where(eq(idColumn, providerId));

      // "Connect" flow: someone is ALREADY signed in and completing OAuth —
      // always link the provider to their current account, never create a
      // second one.
      const sessionUid = await currentSessionUserId();
      if (sessionUid) {
        if (existing && existing.id !== sessionUid) {
          // The provider identity belongs to another account. If that other
          // account is an orphan auto-created by an earlier buggy "connect"
          // (no password, no second provider), reclaim the identity and
          // remove the orphan — the user just proved they own the provider.
          const hasOtherLogin =
            Boolean(existing.passwordHash) ||
            Boolean(provider === "discord" ? existing.githubId : existing.discordId);
          if (hasOtherLogin) {
            // Genuinely someone else's login method — refuse to steal it.
            return "/profile?error=provider-linked-elsewhere";
          }
          await db.delete(users).where(eq(users.id, existing.id));
        }
        await db
          .update(users)
          .set({ ...providerPatch, ...(providerEmail ? { emailVerified: true } : {}) })
          .where(eq(users.id, sessionUid));
        user.id = sessionUid;
        return true;
      }

      if (existing) {
        user.id = existing.id;
        return true;
      }

      // Sign-in (no session): nobody owns this provider id yet, but the
      // provider's verified email matches an existing account — attach the
      // provider to that account instead of creating a duplicate.
      if (providerEmail) {
        const [byEmail] = await db
          .select()
          .from(users)
          .where(eq(users.email, providerEmail));
        if (byEmail) {
          await db
            .update(users)
            .set({ ...providerPatch, emailVerified: true })
            .where(eq(users.id, byEmail.id));
          user.id = byEmail.id;
          return true;
        }
      }

      const id = nanoid();
      const handle = `${(user.name ?? "user").toLowerCase().replace(/[^a-z0-9]/g, "")}${nanoid(4)}`;
      await db.insert(users).values({
        id,
        email: providerEmail ?? `${providerId}@${provider}.glimpse`,
        emailVerified: Boolean(providerEmail),
        name: user.name ?? "New user",
        handle,
        avatarWebpBase64: null,
        discordId: provider === "discord" ? providerId : null,
        githubId: provider === "github" ? providerId : null,
      });
      user.id = id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        const [dbUser] = await db.select().from(users).where(eq(users.id, token.uid as string));
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.handle = dbUser.handle;
          session.user.email = dbUser.email;
          session.user.isEmailVerified = dbUser.emailVerified;
          session.user.avatarWebpBase64 = dbUser.avatarWebpBase64 ?? null;
        }
      }
      return session;
    },
  },
});
