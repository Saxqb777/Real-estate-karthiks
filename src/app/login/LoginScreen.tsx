"use client";
// /login — a game title screen over a street map of Pattukkottai. "Press any key" flies the camera down onto the plot,
// the sign-in card slides in, and a successful sign-in dives the last few metres before handing over to the 3D estate.
// The greeting is in Tamil for the time of day (same day-phase helper as the HUD clock and the 3D lighting).
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, KeyRound, User } from "lucide-react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { useEpochSecond } from "@/components/shell/IstClock";
import { Button, Field, Input, Kbd, cx, useIsClient } from "@/components/ui";
import { api, ApiClientError } from "@/lib/client";
import { dayPhaseAt, formatTimeIST, hourInIST, type DayPhase } from "@/lib/day-phase";
import { MAP_H, M_PER_UNIT, PLOT, TownMap } from "./TownMap";
import s from "./login.module.css";

/** A representative IST hour per phase, so the server-rendered greeting matches the helper's wording. */
const PHASE_HOUR: Record<DayPhase, number> = { dawn: 5, morning: 9, afternoon: 14, evening: 17.5, night: 22 };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const istDay = (now: Date) => {
  const d = new Date(now.getTime() + 330 * 60_000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/* ---------- the map camera ---------- */

type View = { cx: number; cy: number; w: number };
type Stage = "title" | "flying" | "login" | "done";
const FLY_MS = 2800;
const DIVE_MS = 1150;
const PHONE = 768;

/** whole town, filling the screen */
function startView(W: number, H: number): View {
  return { cx: W < PHONE ? 1125 : 1000, cy: 640, w: Math.min(1900, ((MAP_H - 40) * W) / H) };
}
/** street level, the plot centred in the space the card leaves free (left of it; above the sheet on phones) */
function endView(W: number, H: number, dive = 1): View {
  const phone = W < PHONE;
  const w = (phone ? Math.max(150, W * 0.42) : Math.min(340, Math.max(250, W * 0.21))) * dive;
  const k = w / W;
  const tx = phone ? W / 2 : Math.max(W * 0.3, (W - 470) / 2);
  const ty = phone ? Math.max(130, (H - Math.min(500, H * 0.6)) / 2 + 10) : H / 2;
  return { cx: PLOT.x + (W / 2 - tx) * k, cy: PLOT.y + (H / 2 - ty) * k, w };
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t: number) => t * t * t;
const Z_FAR = 1900;
const Z_NEAR = 280;

function niceMetres(m: number) {
  const p = 10 ** Math.floor(Math.log10(m));
  const n = m / p;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p;
}

function useMapCamera() {
  const svgRef = useRef<SVGSVGElement>(null);
  const scaleLabel = useRef<HTMLSpanElement>(null);
  const scaleBar = useRef<HTMLElement>(null);
  const view = useRef<View>({ cx: 1000, cy: 625, w: 1920 });
  const raf = useRef(0);

  const apply = useCallback((v: View) => {
    view.current = v;
    const svg = svgRef.current;
    if (!svg) return;
    const W = window.innerWidth, H = window.innerHeight;
    const h = (v.w * H) / W;
    svg.setAttribute("viewBox", `${(v.cx - v.w / 2).toFixed(2)} ${(v.cy - h / 2).toFixed(2)} ${v.w.toFixed(2)} ${h.toFixed(2)}`);
    const k = v.w / W;
    const z = Math.min(1.25, Math.max(0, Math.log(Z_FAR / v.w) / Math.log(Z_FAR / Z_NEAR)));
    svg.style.setProperty("--k", k.toFixed(4));
    svg.style.setProperty("--z", z.toFixed(3));
    // scale bar: a round distance about 90 px long
    const m = niceMetres(90 * k * M_PER_UNIT);
    if (scaleLabel.current) scaleLabel.current.textContent = m >= 1000 ? `${m / 1000} km` : `${m} m`;
    if (scaleBar.current) scaleBar.current.style.width = `${Math.round(m / M_PER_UNIT / k)}px`;
  }, []);

  const stop = useCallback(() => cancelAnimationFrame(raf.current), []);

  /** fly from the current view to `to` (zoom eased in log space so it feels like a real map) */
  const flyTo = useCallback(
    (to: View, ms: number, ease: (t: number) => number, done?: () => void) => {
      stop();
      const from = { ...view.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = ease(t);
        apply({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, w: from.w * (to.w / from.w) ** e });
        if (t < 1) raf.current = requestAnimationFrame(step);
        else done?.();
      };
      raf.current = requestAnimationFrame(step);
    },
    [apply, stop],
  );

  /** the title screen's slow drift over the town */
  const drift = useCallback(() => {
    stop();
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / 1000;
      const b = startView(window.innerWidth, window.innerHeight);
      apply({ cx: b.cx + Math.sin(t * 0.09) * 26, cy: b.cy + Math.sin(t * 0.07 + 1) * 14, w: b.w * (1 - 0.025 * (1 - Math.cos(t * 0.06))) });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [apply, stop]);

  useEffect(() => stop, [stop]);
  return useMemo(() => ({ svgRef, scaleLabel, scaleBar, apply, flyTo, drift, stop }), [apply, flyTo, drift, stop]);
}

/* ---------- screen ---------- */

export function LoginScreen({ next, initialPhase }: { next: string; initialPhase: DayPhase }) {
  const sec = useEpochSecond();
  const hydrated = useIsClient();
  const now = sec ? new Date(sec * 1000) : null;
  const phase = now ? dayPhaseAt(hourInIST(now)) : dayPhaseAt(PHASE_HOUR[initialPhase]);
  const reduce = useReducedMotion();

  const [stage, setStage] = useState<Stage>("title");
  const stageRef = useRef<Stage>("title");
  stageRef.current = stage;
  const cam = useMapCamera();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<{ text: string; field: "username" | "password" | null } | null>(null);
  const [shake, setShake] = useState(0);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  // first frame: reduced motion skips the show and lands straight on the plot
  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight;
    if (reduce) {
      cam.stop();
      cam.apply(endView(W, H));
      setStage("login");
    } else if (stageRef.current === "title") cam.drift();
  }, [reduce, cam]);

  // keep the framing right when the window changes size
  useEffect(() => {
    const onResize = () => {
      const st = stageRef.current;
      if (st === "login") cam.apply(endView(window.innerWidth, window.innerHeight));
      else if (st === "title" && reduce) cam.apply(startView(window.innerWidth, window.innerHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [cam, reduce]);

  const land = useCallback(() => {
    cam.stop();
    cam.apply(endView(window.innerWidth, window.innerHeight));
    setStage("login");
  }, [cam]);

  /** "press any key": fly down to the plot; a second press skips the flight */
  const start = useCallback(() => {
    const st = stageRef.current;
    if (st === "title") {
      setStage("flying");
      cam.flyTo(endView(window.innerWidth, window.innerHeight), FLY_MS, easeInOut, () => setStage("login"));
    } else if (st === "flying") land();
  }, [cam, land]);

  useEffect(() => {
    if (stage !== "title" && stage !== "flying") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, start]);

  useEffect(() => {
    if (stage === "login") userRef.current?.focus();
  }, [stage]);

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
      setStage("done");
      // dive the last few metres onto the roof, then hand over to the 3D estate
      if (!reduce) cam.flyTo(endView(window.innerWidth, window.innerHeight, 0.16), DIVE_MS, easeIn);
      window.setTimeout(() => window.location.replace(next), reduce ? 0 : DIVE_MS + 80);
    } catch (err) {
      setStatus("idle");
      const ae = err instanceof ApiClientError ? err : null;
      if (ae?.status === 401) fail("Wrong username or password", "password");
      else fail(ae?.message ?? "Couldn't sign in — please try again", null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  const busy = status !== "idle";
  const showCard = stage === "login" || stage === "done";

  return (
    <div className={s.page} data-stage={stage}>
      <TownMap svgRef={cam.svgRef} className={s.map} detail={hydrated} />

      {/* map chrome */}
      <div className={s.scale} aria-hidden>
        <span ref={cam.scaleLabel}>200 m</span>
        <i ref={cam.scaleBar} />
      </div>

      {/* title screen */}
      <AnimatePresence>
        {(stage === "title" || stage === "flying") && (
          <motion.button
            key="title"
            type="button"
            className={s.title}
            onClick={start}
            aria-label={stage === "title" ? "Press to start" : "Skip"}
            initial={false}
            animate={{ opacity: stage === "title" ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: stage === "flying" ? 0.7 : 0.3 }}
          >
            <span className={s.titleShade} aria-hidden />
            <span className={s.titleBlock}>
              <span className={s.titleName}>Pattukottai Estates</span>
              <span className={s.titleMeta}>
                {now ? (
                  <>
                    {istDay(now)}
                    <span className={s.sep}>·</span>
                    <span className="num">{formatTimeIST(now)} IST</span>
                  </>
                ) : (
                  "\u00a0"
                )}
              </span>
              <span className={s.press}>
                <span className={s.pressKeys}>Press any key to start</span>
                <span className={s.pressTap}>Tap to start</span>
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* sign-in card */}
      {showCard && (
        <motion.div
          className={s.cardWrap}
          initial={reduce ? false : { opacity: 0, x: 28, y: 0 }}
          animate={stage === "done" ? { opacity: 0, x: 0, y: 10 } : { opacity: 1, x: 0, y: 0 }}
          transition={{ duration: stage === "done" ? 0.35 : 0.5, ease: [0.22, 1, 0.36, 1], delay: stage === "done" ? 0.25 : 0 }}
        >
          <section ref={cardScope} className={s.card} aria-labelledby="login-title">
            <span className={s.band} aria-hidden />
            <header className={s.brand}>
              <BrandMark size={46} lit={phase.phase === "evening" || phase.phase === "night" || phase.phase === "dawn"} className={s.mark} />
              <div className={s.brandText}>
                <span className={s.kicker}>Quest · your estate</span>
                <h1 id="login-title" className={s.brandName}>
                  Pattukottai Estates
                </h1>
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
                {status === "busy" ? "Signing in…" : status === "done" ? "Signed in" : "Enter estate"}
              </Button>
              <p className={s.hint}>
                <Kbd keys={["enter"]} /> to sign in
              </p>
            </form>
          </section>
        </motion.div>
      )}

      {/* hand-over to the estate */}
      <AnimatePresence>
        {stage === "done" && (
          <motion.div
            key="travel"
            className={s.travel}
            role="status"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: reduce ? 0 : DIVE_MS / 1000 - 0.5, ease: "easeIn" }}
          >
            <span className={s.travelText}>Arriving at your estate…</span>
            <span className={s.travelBar}>
              <i />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
