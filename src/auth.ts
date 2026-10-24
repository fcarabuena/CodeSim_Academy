import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { fakeVerify, verifyPassword } from "@/lib/password";
import { authLimiter, clientIp } from "@/lib/rate-limit";
import { logInSchema } from "@/lib/validation";

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

export const githubEnabled = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      const parsed = logInSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      if (!authLimiter(`login:${clientIp(request.headers)}:${email}`).ok) {
        throw new TooManyAttempts();
      }

      const user = await db.user.findUnique({ where: { email } });
      const ok = user?.passwordHash
        ? await verifyPassword(password, user.passwordHash)
        : await fakeVerify(password);
      if (!user || !ok) return null;

      return { id: user.id, name: user.name, email: user.email };
    },
  }),
];

if (githubEnabled) {
  providers.push(
    GitHub({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Render terminates TLS in front of the app; AUTH_URL pins the public origin.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== "github") return true;
      // No adapter: GitHub users are matched to our User table by email.
      const email = user.email?.toLowerCase();
      if (!email) return "/login?error=github_no_email";
      await db.user.upsert({
        where: { email },
        update: {},
        create: { email, name: user.name ?? null },
      });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // First call after sign-in: resolve our own user id and role.
        const where =
          account?.provider === "github"
            ? { email: user.email!.toLowerCase() }
            : { id: user.id! };
        const dbUser = await db.user.findUnique({ where, select: { id: true, role: true } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
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
});

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; name?: string | null; email?: string | null; image?: string | null };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
