import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/session";

const Body = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Wrong-password limit (health check, 5/10/2026): 5 misses from one address in 15 min → locked out for the rest of the
// window. Kept in memory per server instance — on top of the long random password, it just stops fast guessing.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_MISSES = 5;
const misses = new Map<string, { n: number; since: number }>();
function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
function lockedOut(ip: string, now: number): boolean {
  const m = misses.get(ip);
  if (!m) return false;
  if (now - m.since > WINDOW_MS) {
    misses.delete(ip);
    return false;
  }
  return m.n >= MAX_MISSES;
}
function recordMiss(ip: string, now: number) {
  const m = misses.get(ip);
  if (!m || now - m.since > WINDOW_MS) misses.set(ip, { n: 1, since: now });
  else m.n++;
  if (misses.size > 5000) misses.clear(); // never grows without bound
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  if (lockedOut(ip, now)) {
    return NextResponse.json({ error: "Too many wrong tries — wait 15 minutes and try again" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const expectedUser = process.env.APP_USERNAME || "estates";
  const expectedPass = process.env.APP_PASSWORD;
  if (!expectedPass) {
    return NextResponse.json({ error: "APP_PASSWORD is not configured on the server" }, { status: 500 });
  }
  const userOk = safeEqual(parsed.data.username.toLowerCase(), expectedUser.toLowerCase());
  const passOk = safeEqual(parsed.data.password, expectedPass);
  if (!userOk || !passOk) {
    recordMiss(ip, now);
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  misses.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(expectedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
