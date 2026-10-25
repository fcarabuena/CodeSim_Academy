import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import { authConfig } from "@/auth.config";
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

class AccountDisabled extends CredentialsSignin {
  code = "account_disabled";
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
      // Only revealed after a correct password, so it can't be used to probe accounts.
      if (user.disabledAt) throw new AccountDisabled();

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
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, user }) {
      if (account?.provider !== "github") return true;
      // No adapter: GitHub users are matched to our User table by email.
      const email = user.email?.toLowerCase();
      if (!email) return "/login?error=github_no_email";
      const existing = await db.user.findUnique({ where: { email }, select: { disabledAt: true } });
      if (existing?.disabledAt) return "/login?error=account_disabled";
      await db.user.upsert({
        where: { email },
        update: {},
        create: { email, name: user.name ?? null },
      });
      return true;
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
    /** When the role was last read from the database (ms since epoch). */
    roleCheckedAt?: number;
  }
}
