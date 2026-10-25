import type { NextAuthConfig } from "next-auth";
import { db } from "@/lib/db";

/**
 * The session part of the Auth.js setup, shared by auth.ts (the full config
 * with providers) and proxy.ts, which reads the signed-in user's role before
 * pages render. The proxy runs on Node.js in Next 16, so it can use the
 * database here.
 */

/**
 * How long a session trusts its stored role before checking the database
 * again. AUTH_ROLE_REFRESH_MS overrides it (the smoke test uses 2 seconds).
 */
export const ROLE_REFRESH_MS = Number(process.env.AUTH_ROLE_REFRESH_MS) || 60_000;

export const authConfig = {
  // Render terminates TLS in front of the app; AUTH_URL pins the public origin.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // First call after sign-in: resolve our own user id and role.
        const where = account?.provider === "github" ? { email: user.email!.toLowerCase() } : { id: user.id! };
        const dbUser = await db.user.findUnique({ where, select: { id: true, role: true } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.roleCheckedAt = Date.now();
        }
        return token;
      }

      // Later requests: re-read the role at most once a minute, so promotions,
      // demotions and disabled accounts take effect without logging out.
      if (token.uid && Date.now() - (token.roleCheckedAt ?? 0) > ROLE_REFRESH_MS) {
        try {
          const dbUser = await db.user.findUnique({ where: { id: token.uid }, select: { role: true, disabledAt: true } });
          if (!dbUser || dbUser.disabledAt) return null; // deleted or disabled: end the session
          token.role = dbUser.role;
          token.roleCheckedAt = Date.now();
        } catch {
          // Database asleep or unreachable: keep the current role and try again next time.
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
