"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { authLimiter, clientIp } from "@/lib/rate-limit";
import { logInSchema, sanitizeTimezone, signUpSchema } from "@/lib/validation";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back so the form keeps what the user typed (never the password). */
  values?: { name?: string; email?: string };
};

function echo(formData: FormData): FormState["values"] {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.slice(0, 200) : undefined;
  };
  return { name: get("name"), email: get("email") };
}

function safeRedirect(target: FormDataEntryValue | null): string {
  // Only allow same-site relative paths, never "//evil.com".
  const t = typeof target === "string" ? target : "";
  return t.startsWith("/") && !t.startsWith("//") ? t : "/dashboard";
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = clientIp(await headers());
  if (!authLimiter(`signup:${ip}`).ok) {
    return { error: "Too many sign-up attempts. Please wait a few minutes and try again.", values: echo(formData) };
  }

  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  }
  const { name, email, password, timezone } = parsed.data;

  try {
    await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        timezone: sanitizeTimezone(timezone),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        fieldErrors: { email: ["An account with this email already exists. Try logging in."] },
        values: echo(formData),
      };
    }
    throw err;
  }

  // Throws a redirect on success, which Next.js turns into a navigation.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
}

export async function logInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "rate_limited") {
        return { error: "Too many login attempts. Please wait a few minutes and try again.", values: echo(formData) };
      }
      return { error: "That email and password don't match. Please try again.", values: echo(formData) };
    }
    throw err; // the success redirect
  }
  return {};
}

export async function gitHubSignInAction() {
  await signIn("github", { redirectTo: "/dashboard" });
}

export async function logOutAction() {
  await signOut({ redirectTo: "/" });
}
