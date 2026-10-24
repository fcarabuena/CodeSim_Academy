import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Burn the same CPU time as a real check when the email is unknown, so
 * "no such user" and "wrong password" cannot be told apart by timing.
 */
export async function fakeVerify(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash("codesim-dummy-password", ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
