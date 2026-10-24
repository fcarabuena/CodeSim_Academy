import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([1, 2, 3, 4].map(() => check("a", 0).ok)).toEqual([true, true, true, false]);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(check("a", 0).ok).toBe(true);
    expect(check("b", 0).ok).toBe(true);
    expect(check("a", 0).ok).toBe(false);
  });

  it("resets after the window", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    check("a", 0);
    expect(check("a", 999).ok).toBe(false);
    expect(check("a", 1000).ok).toBe(true);
  });

  it("reports remaining and retry time", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("a", 100)).toEqual({ ok: true, remaining: 1, retryAfterMs: 1000 });
    check("a", 200);
    expect(check("a", 600)).toEqual({ ok: false, remaining: 0, retryAfterMs: 500 });
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
