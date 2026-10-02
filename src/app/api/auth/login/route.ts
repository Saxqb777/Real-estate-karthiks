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

export async function POST(req: Request) {
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
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
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
