import { describe, expect, it } from "vitest";
import { canChangeRole, canDeleteUser, canOwnClass, canSetDisabled, maskEmail, type TargetUser } from "./admin-rules";

const me = "admin-1";
const admin2: TargetUser = { id: "admin-2", role: "ADMIN", disabledAt: null };
const self: TargetUser = { id: me, role: "ADMIN", disabledAt: null };
const student: TargetUser = { id: "s1", role: "STUDENT", disabledAt: null };
const disabledAdmin: TargetUser = { id: "admin-3", role: "ADMIN", disabledAt: new Date() };

describe("canChangeRole", () => {
  it("lets an admin promote and demote other users", () => {
    expect(canChangeRole(me, student, "TEACHER", 2)).toEqual({ ok: true });
    expect(canChangeRole(me, admin2, "STUDENT", 2)).toEqual({ ok: true });
  });

  it("never lets admins change their own role", () => {
    expect(canChangeRole(me, self, "TEACHER", 5).ok).toBe(false);
  });

  it("keeps at least one active admin", () => {
    expect(canChangeRole(me, admin2, "TEACHER", 1)).toMatchObject({ ok: false, reason: expect.stringMatching(/last admin/) });
    // A disabled admin doesn't count, so demoting them is fine.
    expect(canChangeRole(me, disabledAdmin, "STUDENT", 1)).toEqual({ ok: true });
  });

  it("rejects no-op changes", () => {
    expect(canChangeRole(me, student, "STUDENT", 2).ok).toBe(false);
  });
});

describe("canSetDisabled", () => {
  it("disables and re-enables other accounts", () => {
    expect(canSetDisabled(me, student, true, 1)).toEqual({ ok: true });
    expect(canSetDisabled(me, { ...student, disabledAt: new Date() }, false, 1)).toEqual({ ok: true });
  });

  it("never disables yourself or the last active admin", () => {
    expect(canSetDisabled(me, self, true, 3).ok).toBe(false);
    expect(canSetDisabled(me, admin2, true, 1).ok).toBe(false);
    expect(canSetDisabled(me, admin2, true, 2)).toEqual({ ok: true });
  });

  it("rejects no-op changes", () => {
    expect(canSetDisabled(me, student, false, 2).ok).toBe(false);
    expect(canSetDisabled(me, disabledAdmin, true, 2).ok).toBe(false);
  });
});

describe("canDeleteUser", () => {
  it("deletes other users but never yourself or the last admin", () => {
    expect(canDeleteUser(me, student, 1)).toEqual({ ok: true });
    expect(canDeleteUser(me, self, 4).ok).toBe(false);
    expect(canDeleteUser(me, admin2, 1).ok).toBe(false);
    expect(canDeleteUser(me, admin2, 2)).toEqual({ ok: true });
    expect(canDeleteUser(me, disabledAdmin, 1)).toEqual({ ok: true });
  });
});

describe("canOwnClass", () => {
  it("allows enabled teachers and admins only", () => {
    expect(canOwnClass({ role: "TEACHER", disabledAt: null })).toEqual({ ok: true });
    expect(canOwnClass({ role: "ADMIN", disabledAt: null })).toEqual({ ok: true });
    expect(canOwnClass({ role: "STUDENT", disabledAt: null }).ok).toBe(false);
    expect(canOwnClass({ role: "TEACHER", disabledAt: new Date() }).ok).toBe(false);
  });
});

describe("maskEmail", () => {
  it("hides most of the local part and keeps the domain", () => {
    expect(maskEmail("ada.lovelace@example.com")).toBe("a***e@example.com");
    expect(maskEmail("jo@school.org")).toBe("j***@school.org");
    expect(maskEmail("x@a.co")).toBe("x***@a.co");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
