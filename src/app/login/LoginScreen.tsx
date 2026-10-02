"use client";
// /login — the title screen: the living diorama turns slowly behind a compact sign-in card that greets the owner in
// Tamil for the time of day (same day-phase helper as the HUD clock and the 3D lighting).
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, KeyRound, User } from "lucide-react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import EstateSceneLazy, { type SceneInsets } from "@/components/estate/EstateSceneLazy";
import { BrandMark } from "@/components/shell/BrandMark";
import { useEpochSecond } from "@/components/shell/IstClock";
import { Button, Field, Input, Kbd, cx, useIsClient } from "@/components/ui";
import { api, ApiClientError } from "@/lib/client";
import { dayPhaseAt, formatTimeIST, hourInIST, type DayPhase } from "@/lib/day-phase";
import type { SceneUnit } from "@/lib/site-layout";
import s from "./login.module.css";

/** Two calm, nameless townhouses — nothing private is shown before signing in. */
const UNITS: SceneUnit[] = [
  { id: "front", name: "", position: "front", floors: 2, footprintWidthFt: null, footprintDepthFt: null, status: "occupied", rentState: "paid", isActive: true },
  { id: "back", name: "", position: "back", floors: 2, footprintWidthFt: null, footprintDepthFt: null, status: "occupied", rentState: "paid", isActive: true },
];
const PLOT = {};

/** A representative IST hour per phase, so the server-rendered greeting matches the helper's wording. */
const PHASE_HOUR: Record<DayPhase, number> = { dawn: 5, morning: 9, afternoon: 14, evening: 17.5, night: 22 };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const istDay = (now: Date) => {
  const d = new Date(now.getTime() + 330 * 60_000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export function LoginScreen({ next, initialPhase }: { next: string; initialPhase: DayPhase }) {
  const sec = useEpochSecond();
  const hydrated = useIsClient();
  const now = sec ? new Date(sec * 1000) : null;
  const phase = now ? dayPhaseAt(hourInIST(now)) : dayPhaseAt(PHASE_HOUR[initialPhase]);
  const reduce = useReducedMotion();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<{ text: string; field: "username" | "password" | null } | null>(null);
  const [shake, setShake] = useState(0);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  // frame the world in the space the card leaves free (left on wide screens, above the sheet on phones)
  const cardRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState<SceneInsets | undefined>(undefined);
  const measure = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const phone = window.innerWidth < 768;
    const next: SceneInsets = phone
      ? { top: 0, right: 0, bottom: Math.max(0, Math.round(window.innerHeight - r.top)), left: 0 }
      : { top: 0, right: 0, bottom: 0, left: Math.round(r.right + 12) };
    setInsets((cur) => (cur && cur.left === next.left && cur.bottom === next.bottom ? cur : next));
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (cardRef.current) ro.observe(cardRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const fail = (text: string, field: "username" | "password" | null) => {
    setError({ text, field });
    setShake((n) => n + 1);
  };
  // a short head-shake of the card on a failed try (not with reduced motion)
  const [cardScope, animateCard] = useAnimate<HTMLElement>();
  useEffect(() => {
    if (!shake || reduce || !cardScope.current) return;
    void animateCard(cardScope.current, { x: [0, -9, 8, -5, 4, 0] }, { duration: 0.42, ease: "easeOut" });
  }, [shake, reduce, animateCard, cardScope]);

  // after a failed try (and once the fields are enabled again) put the cursor where the fix goes
  const errorField = error?.field;
  useEffect(() => {
    if (!shake || status !== "idle") return;
    const target = errorField === "username" ? userRef.current : passRef.current;
    target?.focus();
    target?.select();
  }, [shake, status, errorField]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    if (!username.trim()) return fail("Enter your username", "username");
    if (!password) return fail("Enter your password", "password");
    setError(null);
    setStatus("busy");
    try {
      await api("/api/auth/login", { method: "POST", body: { username: username.trim(), password } });
      setStatus("done");
      window.setTimeout(() => window.location.replace(next), reduce ? 0 : 380);
    } catch (err) {
      setStatus("idle");
      const ae = err instanceof ApiClientError ? err : null;
      if (ae?.status === 401) fail("Wrong username or password", "password");
      else fail(ae?.message ?? "Couldn't sign in — please try again", null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  const busy = status !== "idle";

  return (
    <div className={s.page} data-phase={phase.phase}>
      <div className={s.world} aria-hidden>
        <EstateSceneLazy className={s.scene} plot={PLOT} units={UNITS} mode="login" timeOfDay="auto" insets={insets} hud={false} />
      </div>
      <div className={s.shade} aria-hidden />

      <motion.div
        ref={cardRef}
        className={s.cardWrap}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <section ref={cardScope} className={s.card} aria-labelledby="login-title">
          <span className={s.band} aria-hidden />
          <header className={s.brand}>
            <BrandMark size={46} lit={phase.phase === "evening" || phase.phase === "night" || phase.phase === "dawn"} className={s.mark} />
            <div className={s.brandText}>
              <h1 id="login-title" className={s.brandName}>
                Pattukottai Estates
              </h1>
              <span className={s.brandSub}>
                <span className="tamil" lang="ta">
                  பட்டுக்கோட்டை
                </span>
                <span className={s.coords}>10.42°N 79.32°E</span>
              </span>
            </div>
          </header>

          <div className={s.greet}>
            <p className={cx("tamil", s.greetTa)} lang="ta">
              {phase.greetingTamil}
            </p>
            <p className={s.greetEn}>
              <span className={s.phaseDot} aria-hidden />
              {phase.english}
              {now && (
                <>
                  <span className={s.sep} aria-hidden>
                    ·
                  </span>
                  <span className="num">{formatTimeIST(now)}</span>
                  <span className={s.sep} aria-hidden>
                    ·
                  </span>
                  {istDay(now)}
                </>
              )}
            </p>
          </div>

          {/* method="post" + a disabled button until hydrated: an Enter pressed before the page is ready can never
              put the password in the address bar */}
          <form className={s.form} onSubmit={submit} method="post" noValidate>
            <Field label="Username" error={error?.field === "username" ? error.text : undefined}>
              <Input
                ref={userRef}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                icon={<User />}
                value={username}
                disabled={busy}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                className={s.input}
              />
            </Field>
            <Field
              label="Password"
              error={error?.field === "password" ? error.text : undefined}
              aside={caps ? <span className={s.caps}>Caps Lock is on</span> : undefined}
            >
              <Input
                ref={passRef}
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                icon={<KeyRound />}
                value={password}
                disabled={busy}
                onKeyUp={onKey}
                onKeyDown={onKey}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className={s.input}
                suffix={
                  <button
                    type="button"
                    className={s.eye}
                    onClick={() => {
                      setShow((v) => !v);
                      requestAnimationFrame(() => passRef.current?.focus());
                    }}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    title={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </button>
                }
              />
            </Field>

            {error && error.field === null && (
              <p className={s.error} role="alert">
                <AlertTriangle aria-hidden />
                {error.text}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={status === "busy"}
              disabled={!hydrated}
              icon={status === "done" ? <Check /> : undefined}
              iconRight={status === "idle" ? <ArrowRight /> : undefined}
              className={cx(s.submit, status === "done" && s.submitDone)}
            >
              {status === "busy" ? "Signing in…" : status === "done" ? "Signed in" : "Sign in"}
            </Button>
            <p className={s.hint}>
              <Kbd keys={["enter"]} /> to sign in
            </p>
          </form>
        </section>
      </motion.div>
    </div>
  );
}
