import { describe, expect, it } from "vitest";
import { logInSchema, sanitizeTimezone, signUpSchema } from "./validation";

describe("signUpSchema", () => {
  const valid = { name: " Ada ", email: " Ada@Example.COM ", password: "longenough" };

  it("trims the name and normalises the email", () => {
    const r = signUpSchema.parse(valid);
    expect(r.name).toBe("Ada");
    expect(r.email).toBe("ada@example.com");
  });

  it("rejects short passwords and bad emails", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("drops unknown fields", () => {
    const r = signUpSchema.parse({ ...valid, role: "ADMIN" });
    expect(r).not.toHaveProperty("role");
  });
});

describe("logInSchema", () => {
  it("requires a password", () => {
    expect(logInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("sanitizeTimezone", () => {
  it("keeps real IANA zones", () => {
    expect(sanitizeTimezone("Europe/London")).toBe("Europe/London");
  });
  it("drops invalid or empty input", () => {
    expect(sanitizeTimezone("Mars/Olympus")).toBeUndefined();
    expect(sanitizeTimezone("")).toBeUndefined();
    expect(sanitizeTimezone(undefined)).toBeUndefined();
  });
});
