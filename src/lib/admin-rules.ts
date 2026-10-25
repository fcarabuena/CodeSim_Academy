/**
 * Safety rules for admin actions. Pure functions, unit-tested; the admin
 * server actions call them inside a transaction that has locked the admin
 * rows, so two admins acting at once can't leave the site without an admin.
 */

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export type TargetUser = { id: string; role: Role; disabledAt: Date | null };

export type RuleResult = { ok: true } | { ok: false; reason: string };

const ok: RuleResult = { ok: true };
const no = (reason: string): RuleResult => ({ ok: false, reason });

/** An admin counts towards "at least one admin" only while enabled. */
const isActiveAdmin = (u: TargetUser) => u.role === "ADMIN" && u.disabledAt === null;

export function canChangeRole(actorId: string, target: TargetUser, newRole: Role, activeAdmins: number): RuleResult {
  if (target.role === newRole) return no("That user already has this role.");
  if (target.id === actorId) return no("You can't change your own role. Ask another admin.");
  if (isActiveAdmin(target) && newRole !== "ADMIN" && activeAdmins <= 1) {
    return no("This is the last admin. Make someone else an admin first.");
  }
  return ok;
}

export function canSetDisabled(actorId: string, target: TargetUser, disable: boolean, activeAdmins: number): RuleResult {
  if (disable && target.disabledAt) return no("That account is already disabled.");
  if (!disable && !target.disabledAt) return no("That account is already enabled.");
  if (target.id === actorId) return no("You can't disable your own account.");
  if (disable && isActiveAdmin(target) && activeAdmins <= 1) {
    return no("This is the last admin. Make someone else an admin first.");
  }
  return ok;
}

export function canDeleteUser(actorId: string, target: TargetUser, activeAdmins: number): RuleResult {
  if (target.id === actorId) return no("You can't delete your own account.");
  if (isActiveAdmin(target) && activeAdmins <= 1) {
    return no("This is the last admin. Make someone else an admin first.");
  }
  return ok;
}

/** Only teachers and admins can own a class. */
export function canOwnClass(user: { role: Role; disabledAt: Date | null }): RuleResult {
  if (user.disabledAt) return no("That account is disabled.");
  if (user.role === "STUDENT") return no("Only teachers and admins can own a class.");
  return ok;
}

/** "ada.lovelace@example.com" -> "a***e@example.com". Used everywhere admins see emails. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local.at(-1)}@${domain}`;
}
