import type { NextAuthConfig } from "next-auth";

/**
 * The part of the Auth.js setup that only reads and writes the session
 * cookie, with no database access. Shared by the full config in auth.ts and
 * by proxy.ts, which uses it to read the signed-in user's role cheaply.
 */
export const authConfig = {
  // Render terminates TLS in front of the app; AUTH_URL pins the public origin.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
