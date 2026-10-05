# Pattukottai Estates — project memory

Private rental-portfolio dashboard for ONE owner: 2 townhouse units on 1 plot in Pattukottai, Tamil Nadu.
Currency INR, Indian grouping (lakhs/crores), dates D/M/YYYY. Single user login (APP_USERNAME / APP_PASSWORD).
The owner wants it **visually stunning, game-like and highly interactive** — a 3D diorama of the plot is the centrepiece.

## Stack
- Next.js 15 App Router + TypeScript (`src/`), React 19
- Prisma 6 + Postgres (Neon in prod, project `pattukottai-estates`, id `solitary-glade-88238517`, region aws-ap-southeast-1)
- Deployed on Vercel. Auth = signed JWT cookie `pe_session` (jose), checked in `src/middleware.ts`.
- 3D: three + @react-three/fiber 9 + @react-three/drei 10 + @react-three/postprocessing 3. Animation: `motion`. Charts: recharts 3. Icons: lucide-react. Email: resend.
- Tests: vitest (`npm test`).

## Conventions (follow these everywhere)
- camelCase in TS/JSON, snake_case in Postgres via `@map`.
- Money = `Decimal(14,2)` in DB → numbers in JSON (`serialize()` in `src/lib/api.ts` converts Decimal→number, Date→ISO string).
- Date-only fields are UTC-midnight Dates. Use helpers in `src/lib/dates.ts` (`parseDateInput`, `formatDate`, `todayIST`, `toInputDate`). Never use local-time getters on them.
- Formatting: `src/lib/format.ts` (`formatINR`, `formatINRCompact` → ₹45.2 L / ₹1.25 Cr).
- Every API route: wrap with `handler()`, validate with zod via `parseBody` / `parseQuery`, return `json()`. Throw `ApiError` / `notFound()` / `badRequest()` / `conflict()` for clear messages. Reusable zod pieces in `src/lib/validation.ts`.
- ALL money/KPI maths lives in `src/lib/calculations.ts` (pure functions, unit tested). Routes and UI never re-implement formulas.
- Expense totals: Property Tax marked Paid auto-creates a linked Expense (category "Property Tax"), so expense totals come from the Expense table only.
- Singletons: Settings id=1, Plot id=1 (seeded).

## Site plan (owner's ANNOTATED plan, images/8.jpg — source of truth)
Plot: FRONT width 23'3" (23.25 ft, "Gate to Unit A"), BACK width 22'3" (22.25 ft), depth 76' (label 76.66 ft), area 1,744.02 sqft.
Right boundary straight; left boundary = the LANE side (slants). Drawing bottom = front.
From the front: front yard ~10 ft (Unit A entrance + stair) → Unit A (front, 20×28) → courtyard ~10 ft (Unit B entrance +
stair; "Gate to Unit B" in the lane wall here) → Unit B (back, 20×28) against the back.
Each house: entrance + grilled veranda at its front-LEFT; external dog-leg stair OUTSIDE the footprint in the yard in front of
its front-RIGHT corner, up to the terrace; rear-RIGHT notch = small open backyard with a bathroom and a back-exit door.
Compound wall = a separate enclosure on the boundary (never touches a house): ~3 ft lane passage on the left, 1.5 ft clear
strip on the right and at the back (the 3D draws the houses slightly narrower than 20 ft for this; labels keep 20').
Exactly two gates: Gate A in the front wall (left/centre, before the stair), Gate B in the lane wall at the courtyard.
These defaults are used when Plot/Unit dimension fields are empty (SITE_PLAN_DEFAULTS / SITE_DEFAULTS).

## Local dev in the cloud container
The container cannot reach Neon (egress policy). Use the local Postgres: `service postgresql start`,
DB `estates_dev` (user/pass `estates`). `.env` points there. Neon creds are in gitignored `.env.neon`.
Apply schema changes to Neon via the Neon MCP (`run_sql_transaction`) or via `prisma migrate deploy` in the Vercel build.

## Working agreement with the owner
- Keep replies simple, bullet points; explain deeply only when asked.
- Never ship a change without the owner's final confirmation.
- Work in steps; stop after each step for review.

## Owner decisions log (keep updated — cross-session memory)
- Owner lives in the UAE (Gulf time, UTC+4, 1.5 h behind IST); the property is in Pattukottai. App clock + 3D day/night follow IST
  (property time); quote ETAs/times to the owner in UAE time. Home-clock label in the app = "GST" (owner, 5/10/2026).
- Login: username `estates`, random password in env `APP_PASSWORD` (owner has it). Next.js 15, Neon region Singapore.
- Design = full game-like prototype now (not plain forms). See docs/DESIGN.md — it is the source of truth for UI, including:
  no-AI-look rules, living world (traffic, people, wind), Tamil day phases (src/lib/day-phase.ts), ONE-SCREEN rule (no long scroll),
  "inspect like a game" interaction model (hover tooltip → anchored card → side panel), world objects as data entry points,
  drill-down numbers, radial action menu, time scrubber (as-of date), both quick-edit pop-ups and Data/Config pages.
- Model: stay on Opus 5.5 (owner's choice). Figma available for review hand-off (screens → Figma for owner mark-up).
  Higgsfield available but avoid AI-generated imagery (conflicts with no-AI-look); ask before spending credits.
- 3/10/2026: weekly usage at 90% → owner chose "Trim & ship": finish game screen + reports/login agents, skip the
  critic/judge/fixer passes, main session does final checks + deploy. Polish passes after the Sunday 4:00 AM reset.
- Plot dimensions are NOT seeded (DB starts empty); site-plan values are fallbacks + a "use site plan dimensions" option.
- Every number must be explainable: "Show the maths" (plain words → formula → with your numbers → source records + assumptions),
  generated by the calculations module's `explain` output so UI never drifts from the real maths. See docs/DESIGN.md.
- Yearly grouping: Indian FY (Apr–Mar) by default with a toggle to calendar year (owner choice).
- DATA CLARITY CONTRACT in docs/DESIGN.md is mandatory: cash vs paper value vs occupancy always separated and tagged, scope chip on every
  number, fixed vocabulary, deposits ≠ income, visible reconciliation, identical formats everywhere.
- Layout: immersive world-as-background (option A), CLEAN by default — panels open on click (house, chips, objects) with pin-to-keep-open; focus dimming; option B (framed) switchable via a layout prop.
- 3/10/2026 owner sent real photos (houses 116/87): 3D houses now match them — SINGLE STOREY + flat roof terrace (default floors 1,
  demo seed floors 1), ivory-cream walls with black accent lines, raised stepped front parapet with 2 arched jaali vents, chajja with
  black edge over a grilled front-left veranda (fluted pillars), maroon-framed grilled windows, straight external stair (solid cream
  balustrades + round black rails) in the notch, maroon meter box, black tank on a cream stand; compound wall cream with black line
  pattern on the lane (left) side, quatrefoil jaali panels, black diamond gates, "116/87" plate. Road, shoulders, drain, kerbs and ALL
  traffic REMOVED (Traffic.tsx deleted) — open grass on the island (`layout.site.meadow`), EB poles on the grass right of the gate,
  people walk across the grass / round the palms and banana garden, cow grazes under the front-right palms.
- 3/10/2026 follow-up (owner): layout MIRRORED to match photos 6/7 — lane on the left long side (black-banded wall), houses
  flush to it, notch + stair + main gate at the front-left (lane corner, "116/87" pillar), veranda at the front-right,
  passage on the right; second gate mid-way along the lane wall for the back unit. Default camera (front-left) unchanged.
- 4/10/2026 owner sent the ANNOTATED site plan (images/8.jpg) — supersedes the mirror guess: front 23'3"/back 22'3" (defaults
  swapped), houses flush right with the lane passage left, front yard → A → courtyard → B, stairs in the yards at the
  front-right, rear-right backyard notch (bathroom + back exit), Gate A front wall / Gate B lane wall at the courtyard. Owner:
  "move the compound outside both the property" → wall is a separate enclosure with clear strips, never against a house.
- 4/10/2026 owner (photos 9–11): black line pattern on the compound wall on ALL sides (jaali kept inside it); front parapet
  design CENTRED on each façade like photo 10 (arched jaali panel between two tall risers, stepped risers with small vents at
  BOTH ends, black coping); water tank on the terrace just behind the back-exit / backyard notch; dog-leg stair foot by the
  right wall, arriving at the front-right inside the corner riser (keeps the centred design whole).
- 4/10/2026 owner edit round (deployed together): compound wall = the SAME unbroken black-line pattern on every side,
  outer face only, NO jaali panels; NO windows on the back wall of either house; EB poles one at each FRONT corner
  (right one keeps lamp/meter/service drop, left one off the lane corner); brown door to the 2nd bathroom on the house
  wall facing the backyard (vent above it); dog-leg stair MIRRORED — foot at its LEFT end (by the gate), lower flight
  climbs right, U-turn landing at the right wall, upper flight back left onto the terrace; front parapet PLAIN (raised
  design removed) on both houses. Owner works edit-by-edit, reviews screenshots, then says "deploy".
- 4/10/2026: door-number POLE outside each gate (Gate A → front unit name, Gate B → back unit name, from the data);
  the corner-pillar "116/87" plate is gone. TO-LET board English only (no Tamil line). Fixed: empty baked part lists
  crashed the overview into the 2D fallback (bake() now returns an empty geometry).
- 4/10/2026: number plates self-lit + bigger, pole stands BEHIND the plate. Property tax moved off the wall into a mini
  BAMBOO VILLAGE HUT (owner's sample photo) on the grass right of Unit A, turned to face SOUTH-WEST, dried coconut-LEAF
  thatch roof, NO name board (round paid/due seal kept); one palm removed for it; labels say "Tax office". Notice board
  REPLACED by a walking PROPERTY OFFICER (white shirt/trousers, black shoes, register + pen) looping outside the compound
  wall, stopping at corners to write; clicking him opens the to-dos (kind "noticeboard", label "Property officer").
- 4/10/2026: tax hut UPGRADED (owner: "should be impressed"): no round seal; raised mud floor + kolam, bamboo poles with
  nodes, plank door, lattice window/gables glowing at night, layered leaf thatch with loose strips + crossed ridge sticks,
  leaf-roofed porch with clerk's desk (files, ledger, bell, stool), clay pot, hurricane lantern + point light, bicycle,
  firewood + coconuts.
- 4/10/2026: WIND = steady gentle breeze (windAt ≈ 0.42 with a very slow slight swell), no gust ramps; sway FREQUENCIES must
  never depend on wind strength (phase jumps) — only amplitudes may.
- 4/10/2026: school kid (palms loop) REMOVED; an ANGRY POLICEMAN (khaki, red-band cap, moustache, lathi) guards the tax
  hut by its porch (PoliceGuard in People.tsx, placed in the hut's local frame). Domain DNS set at IONOS by owner:
  A @ 76.76.21.21, CNAME www cname.vercel-dns.com (mail records kept).
- 5/10/2026: LOGIN redesigned — no 3D on /login. Game title screen over a hand-drawn street map of Pattukkottai in web-map colours
  (src/app/login/TownMap.tsx, traced from the owner's Google Maps screenshot; no Google logo/imagery, no business names); title +
  IST day/time + "Press any key / Tap to start" (no logo, no Tamil on the title, no location pill). Key → camera flies to the plot
  (red pin), sign-in slides in, success dives onto the roof → 3D page.
- 5/10/2026: sign-in = game HUD BAR at the bottom (owner picked mock option D): "PATTUKKOTTAI ESTATE" + IST day/time | username |
  password | big centred "ENTER ▶"; stacks into a bottom panel on phones. No logo, no Tamil, no "your estate"/"quest" anywhere;
  map pin tag reads "PATTUKKOTTAI ESTATE". Pending owner answer: title screen still "PATTUKOTTAI ESTATES" (rename to match?);
  Tamil still on map area labels.
- 5/10/2026: "?" help view = name TAGS on the world objects only (no "opens" sub-line, no help/shortcut box, no HUD hint
  boxes). Owner wants the overview to become JUST the 3D model (remove shell top bar + overview top strip + bottom dock/
  timeline), everything reachable from world objects — plan proposed (milestone → property+charts, sun/moon → time/period,
  officer register → Data, plot marker → Config); pending owner answers on logout placement + Data/Config "Back" button.
- 5/10/2026: owner's WHITE LAND CRUISER 100 (src/components/estate/LandCruiser.tsx) — rebuilt from his model screenshots
  (his original file could not be copied from his Mac): primitives merged per material, maroon/gold/grey decals, six-spoke
  alloys, WIDE rectangular sunroof, HAZARD LIGHTS (all 4 corner indicators + side repeaters) blink amber ~85/min. Parked on
  the front-left grass (ParkedCar in Fixtures.tsx), nose ENE (rotation π/8; world +X = east, −Z = north). The 3 cross-the-
  front walkers now keep to z −4.6…−6 so they pass between the car and the front wall.
- 5/10/2026: SIGN OUT = the CAR (owner): click it (kind "car", tag "Car") → game-style prompt "LEAVE PATTUKKOTTAI ESTATES?"
  (LeavePrompt.tsx, Stay / Drive off ▶, Enter/Y · Esc/N) → `estate:leave` event: hazards off, head/tail lamps on, car
  backs out swinging its nose, drives off the front of the island; screen fades ("Leaving the estate…") → logout() → /login
  title screen (~4.6 s). Still pending: Data/Config "← Back to estate" button + whether to remove the welcome tour.
- 5/10/2026: HOVER on any world object = just its NAME TAG (WorldHint → .worldTag, unit name for houses), no detail box.
- 5/10/2026: tax office hut (with the policeman, in its local frame) now faces SSW (group rotation −π/8; was SW −π/4).
- 5/10/2026: SUN / MOON = time (owner): the sky backdrop publishes the brighter body's screen pos (estate/sky-body.ts);
  SkyTarget (overview/SkyTime.tsx) rides on it — hover = tag "7:09 AM IST · 5:39 AM UAE", click = TIME TRAVEL panel with
  the as-of timeline ONLY (period buttons All time/FY/month + FY/CAL REMOVED — owner: useless; figures default to current
  FY; ⌘K can still switch). Sun/moon path kept high (y 0.76–0.88) so it's never hidden behind the island. Timeline left the
  bottom bar; top shell bar lost its IST/UAE clock and its sign-out button (car does that; ⌘K "Sign out" remains).
  Desktop only so far — phones still use their bottom sheet for the timeline.
- 5/10/2026: floating unit labels ("116/B7" chips above the houses) REMOVED from the overview (showLabels off); names show on hover / "?" tags.
- 5/10/2026: overview TOP STRIP REMOVED entirely on desktop (Property (P) button — plot marker opens plot + property
  breakdown — status chips, Setup quest button, as-of chip, ? and full-screen buttons). Keys still work (P, ?, F, ⌘K).
  Remaining HUD: shell top bar (brand · Overview/Data/Config · Jump to…) and the bottom chart dock.
- 5/10/2026: walking man = PROPERTY MANAGER (renamed from officer everywhere). Hover bug fixed: a moving hotspot re-registers
  with its new anchor on every hover change and the cleanup cleared the hover — now cleared only if the spot is really gone
  (queueMicrotask check in EstateScene register); he is also re-picked ~8×/s (events.update) and has a bigger hit box.
- 5/10/2026: chart dock has NO open/close arrow — click a tab to open, the same tab again to close (keys 1–6 too);
  LIFE ON button sits above the dock with its right edge aligned to the dock's (insets.right + 14). Dock tabs: no number
  badges (keys 1–6 still work), icon + label centred in equal slots.
- 5/10/2026: SHELL TOP BAR REMOVED — only a floating OVERVIEW · DATA · CONFIG pill at the top centre (HudBar.tsx →
  .floatNav; hidden on phones, which keep MobileTabBar; non-overview pages get 60px top padding). ⌘K still opens search.
- 5/10/2026: NO TAMIL anywhere on the site (owner): Data/Config headings, receipt/report letterheads, login map labels,
  3D Tamil lettering (useTamilFont → false). (day-phase.ts still holds Tamil phase names as data; not rendered.)
- 5/10/2026: NO INSTRUCTIONS anywhere (owner): first-run tour never auto-starts, setup quest log hidden, "not opened yet"
  hint dots off, Field `hint` text + FormSection `note` not rendered (errors still are), RailScreen key-hint footer gone.
  Kept (counts/labels, not instructions): rail item sublines ("1 current"), ₹ previews, switch labels, empty-state lines.
- 5/10/2026: units are called by their NAMES (door numbers 116/B7 front, 116/B8 back) everywhere — positionLabel() returns
  null so chips/panels/charts show the unit name, never "Front"/"Back" unit; dock tab 3 = "<back name> vs <front name>"
  (live: "116/B8 vs 116/B7"). Plot "front/back width" and the unit Position picker in Config keep their geometry words.
- 5/10/2026: panel footers carry no instruction ("Click a number for its breakdown", Esc hints, drill-down hint lines removed);
  figure hover tips show the exact amount only. Click-to-drill still works.
- 5/10/2026: DATA/CONFIG = option C game look (owner): section buttons across the top (RailScreen), fixed blurred estate
  backdrop (public/estate-backdrop.jpg), gold game panels via `[data-game-main]` in Panel.module.css, tenants + leases as
  character cards (data/cards.tsx GameCard/CardGrid); payments/expenses stay tables. "← Back" question moot (floating nav).
- 5/10/2026: SMOOTH ARRIVAL: login hands over with router.replace (soft nav) and preloads the 3D chunk; overview shows ONE
  "Arriving at your estate…" cover (same as login hand-over) until data + 4 rendered frames (EstateScene `onFirstFrame`),
  then fades 0.6 s; scene mounts only once data is in; no main fade on "/"; camera flights advance by capped dt (no jumps).
- 5/10/2026: Settings "Subtitle" field + Categories "Built-in categories keep their names…" note REMOVED (owner). SMOOTHNESS
  pass 2: 3D quality tier is fixed for the session (PerformanceMonitor used to drop high→mid during the slow first frames →
  rebuilt the world, palms/grass popped); now it only nudges render resolution (dpr ±0.25, starts after 5 s; caps high 1.5,
  mid 1.25). No live backdrop blur on HUD over the canvas (float nav, dock, Life button) or the Data/Config game panels.
- 5/10/2026: POP-UPS = option D (owner): EVERY world object (house, manager, mailbox, pole, tax hut, TO-LET, plot marker,
  sun/moon) goes hover TAG → the same GOLD CARD at the object (✕, key facts, actions, "Open ›" last) → "Open" →
  ONE panel on the RIGHT (property panel moved from the left; only one right panel at a time). Card + panel share the gold
  frame (2px #c9922e, radius 10, glow, uppercase titles). CAR is the exception (owner, 5/10): click → leave prompt straight away, no card; sun card (IST/GST) "Open"
  → time travel. DIRECT list empty; no "Enter to expand" hint.
- 5/10/2026: OPENED PANEL = CENTRE GAME MENU (owner picked option 3 over floating-right / grow-in-place / bottom drawer):
  "Open" shows the panel as one wide window (≤1080px) in the middle over a darkened world (.centreShade, click = close
  unless pinned); sections flow in up to 3 columns ([data-centre-panel] in hud.module.css); camera no longer shifts for a
  right inset; hover tags hidden while it's open. (No tabs yet — the mock's tabs were not built.) Centre body = CSS GRID
  (auto-fit ≥300px columns), NOT CSS columns (columns split sections → overlapping text in the EB window).
- 5/10/2026: TAX OFFICE window = a report in 3 columns: Summary (paid in total, still to pay, years recorded, last paid,
  average a year) · By unit (paid so far, latest year + status, years paid) · Year by year (total + bar + per-unit rows,
  Mark paid). Totals via sumAmounts().
- 5/10/2026: NOTES/INSTRUCTIONS SWEEP (owner, again): HudPanel renders no text hint (only non-text footers like the ledger
  badge); panel notes removed (pole bill note, to-do "done items" note, tax/pole/to-do footers, FigLine explanatory subs,
  "— best offer"/"days let ÷ days owned" label tails, deposits line now "Deposits held ₹…"); static EmptyState descriptions
  removed (errors still show); FormNote renders only tone="warn"; reports hide .tableNote/.secNote/.lineNote/.note (not
  coral warnings)/.hint; "Click an offer…" list hint, copy-toast and setup toast descriptions removed.
- 5/10/2026: BUG FIX (owner): a pinned window (e.g. the EB pole) reopened on every page load — the pinned-panel restore
  on load is REMOVED; the overview always starts on the clean 3D world. 📌 still keeps a window open while clicking around.
- 5/10/2026: CAR ARRIVAL (owner): each time the estate opens the Land Cruiser drives in from beyond the island's front edge
  (lamps on), slows while turning right, stops past its spot, then REVERSES in with the nose swinging (≈6 s, starts 0.7 s
  after the world shows), brake dip + settle rock, then parks (hazards). Path = forward-time speed/turn profile integrated
  BACKWARDS from the parked pose (arrivalPath in Fixtures.tsx) so it always ends exactly in the spot. Skipped for reduced
  motion. Exit (Drive off) unchanged.
- 5/10/2026: REPORTS = LIBRARY (owner picked sample 1): Data → Reports home = 8 cards with a key number each → one clean
  report per card (‹ Reports back, Print / PDF on each, light A4 via PrintPortal): Income & expenses (year: 3 KPIs, month
  table, where-the-money-went bars, by unit) · Rent roll · Dues & arrears · Occupancy & vacancy (year) · Tenant statement
  (lease picker, month-by-month with receipts + running balance) · Property value & returns · Property tax (year × unit)
  · Deposits held. Year + FY/Calendar control only on the year-based ones; others "As of today". Component
  src/components/reports/ReportLibrary.tsx (+ rlib.module.css); old ReportsHub/AnnualStatement/UnitStory kept but unused.
  Old ?report=ledger&lease= links open the tenant statement.
- 5/10/2026: PRINTABLES = STYLE C (owner picked over Minimal / Classic slip): NO logo, NO round PAID stamp, NO dotted
  border. Header = dark band (#1f1a15) with the name (+ place / generated date) left and the document title in gold +
  reference / scope right (Letterhead in reports/print.tsx, print-color-adjust: exact). Receipt (invoice/[id]/Receipt.tsx,
  .cr* classes): cream amount box with a 5px gold left edge (amount, words, RENT FOR month), list Received from / Property /
  Paid by / Monthly rent, owner's signature line, revenue-stamp box only for cash > ₹5,000, deposit line at the foot.
  Reports print: cream KPI boxes with gold left edge, gold-brown headings, light zebra tables.
- 5/10/2026: RENT TIMING per lease (owner): Lease.rentTiming "advance" (October's rent due in October) | "arrears"
  (October's rent due in NOVEMBER, after living it) + Lease.rentDueDay (null = Settings default). 116/B7 tenant = arrears,
  day 10; previous 116/B8 tenant = advance, day 1. calculations.ts rentDueDayNum(); migration 20261005120000.
  Lease form: "Rent billing" (IN ADVANCE | IN ARREARS) + "Due on day"; lease details "Rent billing: IN ADVANCE | IN ARREARS" (nothing extra — owner). Payment form: "Other" method + Note removed.

## UI conventions (built in round 1)
- Import the UI kit from `@/components/ui` (Panel, Button, Field/Input/NumberInput/DateInput/Select, Tabs, Table, StatusPill,
  AnimatedNumber, StatTile, SegmentedBar, LevelBadge, Modal/Drawer/ConfirmDialog, toast, InspectCard, CommandProvider…);
  data hooks from `@/lib/client` (`api`, `useApi`, `useMutation`, `invalidate`).
- Each page's root is `<Screen>` (`flush contained={false}` for the full-bleed 3D overview). Pages must not render `<main>` (shell owns it).
- Status everywhere uses `<StatusPill>`. Totals use `sumAmounts()`. Shared zod helpers in `src/lib/validation.ts`
  (zMoney accepts "1,00,000" / "₹ 25,000"), `Serialized<T>` in `src/lib/types.ts`, `periodLabel` in `src/lib/dates.ts`.
- `/styleguide` shows every component; `/lab` is the 3D scene sandbox (query params switch states).
- API errors: `{ error, issues?: [{field, message}] }`.

## 3D scene usage
```tsx
import EstateSceneLazy from "@/components/estate/EstateSceneLazy";
import { sceneUnitsFromBreakdown } from "@/lib/site-layout";
<EstateSceneLazy className={s.hero} plot={data.plot} units={sceneUnitsFromBreakdown(data.units)}
  mode="hero" selectedUnitId={sel} onSelectUnit={setSel} onEmptySlotClick={(slot) => …} showLabels />
```
- `highlightField`: frontWidthFt | backWidthFt | depthFt | areaSqft | footprintWidthFt[:front|back|<unitId>] | footprintDepthFt[:…] | floors:… | position
- Extra props: life, quality, hud, wheelZoom, intro, cameraView, debug, timeOfDay (auto|dawn|morning|afternoon|evening|day|dusk|night).
- Visual review: `/lab?units=2&state=overdue&state2=vacant&time=night&dims=1&hl=depthFt&mode=preview&panel=0&intro=0&q=high`.

## Local dev servers (agents)
- `scripts/dev-server.sh <name> <port>` starts a private dev server with its own build dir (.next-<name>); stop with
  `scripts/dev-server.sh stop <port>`. Screenshots: `BASE=http://localhost:<port> node scripts/shot.mjs <outDir> <paths…>`.

## Calculation rule decisions (round 2)
- Lease endDate = LAST DAY of tenancy (inclusive). Occupied interval = [startDate, endDate + 1 day). Last rent month = month of endDate.
  Next lease may start the day after. UI label: "Last day of tenancy".
- "Current" lease = startDate ≤ today ≤ endDate (or no endDate). Future-start lease = "incoming". Rent roll counts current leases only.
- Arrears = every unpaid or part-paid month from lease start to the current period (paid amount per period vs monthlyRent).
- CAGR shown only when holding ≥ 1 year; otherwise null with note "under 1 year".
- Holding years = investment-weighted average (explained in show-the-maths). Rent lost before first lease uses the next lease's rent (noted).
- Total Return = appreciation (active units) + all rent collected (spec), explained in show-the-maths.

## Deployment (set up during round 2)
- Neon: init migration + defaults applied to project `solitary-glade-88238517` (12 tables, 6 categories, Settings/Plot rows, NO data).
- Vercel: team `saxqb777's projects` (team_yKuXQ8P3eoGrvRnTWMIqSiGo), project `pattukottai-estates` (prj_ne43LdS6pow2gGtw0aM0RrGonUin),
  linked to GitHub saxqb777/real-estate-karthiks (default branch = claude/adoring-franklin-79djqy), region sin1 (next to Neon),
  Node 22.x, build `npx prisma migrate deploy && npm run build`. Env: DATABASE_URL (Neon pooled, pgbouncer=true), DIRECT_URL,
  APP_USERNAME, APP_PASSWORD, SESSION_SECRET (production secret differs from local). Vercel Authentication only on previews;
  production URL is public behind the app's own login.
- LIVE 3/10/2026: https://pattukottai-estates.vercel.app (builds un-paused; every push to the branch redeploys production).

## Owner's done-check (automated)
`scripts/done-check.mjs` enters the owner's test case through the real API (2 units, 1 offer, 1 tenant, 1 lease, 3 payments,
2 expenses incl. a Paid property tax), recomputes every figure with an INDEPENDENT implementation of the spec formulas and checks
that rent/expense totals are identical across /api/payments, /api/expenses, /api/expense-categories, /api/dashboard (kpis, periods,
unit cards, composition, explain), /api/reports/annual and /api/reports/rent-ledger. Run on an EMPTY database:
`scripts/dev-server.sh check 3300 estates_donecheck && BASE=http://localhost:3300 node scripts/done-check.mjs --cleanup`
(DB estates_donecheck exists, migrated + seeded; --cleanup leaves it empty again). Refuses non-localhost targets.
First run (round 2, 3/10/2026): 52/52 checks passed.
