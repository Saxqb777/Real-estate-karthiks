import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentDayPhase } from "@/lib/day-phase";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { LoginScreen } from "./LoginScreen";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Only same-site paths inside the app (never another origin, the login page itself or a raw API URL). */
function safeNext(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v === "/login" || v.startsWith("/login?") || v.startsWith("/api/")) return "/";
  return v;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  // already signed in → straight through
  if (await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect(next);
  return <LoginScreen next={next} initialPhase={currentDayPhase().phase} />;
}
