import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(60, "Name is too long."),
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().max(64).optional(),
});

export const logInSchema = z.object({
  email: emailSchema,
  // No length rules on login: just reject absurd payloads.
  password: z.string().min(1, "Enter your password.").max(128),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/** Accept only real IANA zone names; anything else becomes undefined. */
export function sanitizeTimezone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}
