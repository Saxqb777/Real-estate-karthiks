// Edge-safe session helpers (used by middleware and route handlers).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pe_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short (min 16 chars)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(username: string) {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub === (process.env.APP_USERNAME || "estates");
  } catch {
    return false;
  }
}
