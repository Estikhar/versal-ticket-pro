import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/** Signed httpOnly admin session — replaces sending the password on every call. */
const TTL_MS = 8 * 60 * 60 * 1000;
export const COOKIE = "idv_admin";

const secret = () =>
  process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";

export function issueToken(): string {
  const payload = `${Date.now() + TTL_MS}.${randomBytes(9).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}

export function verifyToken(token?: string): boolean {
  if (!token || !secret()) return false;
  const [exp, nonce, sig] = token.split(".");
  if (!exp || !nonce || !sig) return false;
  const want = createHmac("sha256", secret()).update(`${exp}.${nonce}`).digest("hex");
  const a = Buffer.from(sig, "hex"), b = Buffer.from(want, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
}

export function passwordOk(given: string): boolean {
  const real = process.env.ADMIN_PASSWORD ?? "";
  if (!real) return false;
  const a = Buffer.from(given.padEnd(64).slice(0, 64));
  const b = Buffer.from(real.padEnd(64).slice(0, 64));
  return timingSafeEqual(a, b) && given.length === real.length;
}
