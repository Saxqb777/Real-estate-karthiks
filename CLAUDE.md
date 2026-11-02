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
  frame (2px #c9922e, radius 10, glow, uppercase titles). CAR is the exception (owner, 5/10): click → leave prompt straight away, no card; sun/moon: NO card — click opens time travel straight away; ring + time tag show ONLY while hovering (owner 5/10); was: sun card (IST/GST) "Open"
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
- 5/10/2026: SUN/MOON PATH (owner): still moves with the real time (fixed position rejected — bad day/night transition), but the
  arc now DIPS in the middle (y = 0.78 centre … 0.83 edges, was 0.76→0.88 peaking at the centre) so the body and its hover
  time tag never slide under the floating top-centre nav. Atmosphere.tsx `arc()`.
- 5/10/2026: RENT TIMING per lease (owner): Lease.rentTiming "advance" (October's rent due in October) | "arrears"
  (October's rent due in NOVEMBER, after living it) + Lease.rentDueDay (null = Settings default). 116/B7 tenant = arrears,
  day 10; previous 116/B8 tenant = advance, day 1. calculations.ts rentDueDayNum(); migration 20261005120000.
  Lease form: "Rent billing" (IN ADVANCE | IN ARREARS) + "Due on day"; lease details "Rent billing: IN ADVANCE | IN ARREARS" (nothing extra — owner). Payment form: "Other" method + Note removed.
- 5/10/2026: PHONES (owner, option B): overview = ONLY the 3D world + the bottom bar (☰ MENU · OVERVIEW · DATA · CONFIG).
  Old phone sheet (Portfolio/This month/Charts/Units/To-do), status chips, ? button and timeline bar REMOVED (MobileSheet deleted).
  ☰ (shell/chart-menu.ts store, MobileTabBar) → gold "CHARTS" list of names only (overview/ChartMenu.tsx) → the chart opens
  as a sheet with an ✕ (Dock `sheet` mode). World taps = same gold card → Open → centre window as desktop; sun/moon → time
  travel. ☰ on Data/Config goes to the overview and opens the menu.
- 5/10/2026: NO GOLD CARD any more (owner, phone + desktop): hover = name tag only, CLICK opens the object's window straight
  away (Overview DIRECT = every kind except the car → leave prompt; sun/moon → time travel). Supersedes the option-D card step.
  Phones: overview fills the whole page (Screen .flush no longer gets the 12px phone padding — that was the top/bottom strip),
  bottom bar's patterned stripe removed, sun/moon time tag ALWAYS shown on touch screens ((hover: none)); the sky target +
  tag hide while a window / chart / menu is open.
- 5/10/2026: REPORTS ON PHONES (owner; phone only, desktop + print unchanged): report panels carry data-wrap-head → header
  controls wrap under the title (title 22px); library cards one column (grid-auto-rows max-content — they overlapped);
  every report table (TableBox in ReportLibrary) becomes one small CARD PER ROW on phones (first cell = heading, other
  cells "COLUMN … value", labels copied from the header row into data-label). Site meta DESCRIPTION removed (owner: link
  previews must be plain — title only).
- 5/10/2026: DATA → PROPERTY TAX on phones: 2 columns — "year · unit / paid date" + amount with the MARK PAID button or
  PAID pill stacked under it (.taxAmt); nothing runs off the right edge.
- 5/10/2026: courtyard TULSI MAADAM removed (owner). TENANTS WALK (owner): each tenant waits outside the unit's own gate,
  the gate leaf (hinged on its left pillar, GateLeaf in PlotGround, swings INTO the plot) opens when they are within
  2.4 ft (estate/gate-state.ts gateNear), they walk in, climb the dog-leg stair (lower flight → landing → upper flight →
  platform), stroll on the terrace (pause looking out front), come back down, out of the gate and it shuts. Route =
  tenantRoute() in People.tsx (plan ft legs with speeds + pauses, ~14 s wait outside). Still clickable (moving hotspot).
- 5/10/2026: tenant HOVER on the stairs / terrace fixed: Canvas events filter puts hits flagged userData.pickFirst (the
  tenant's hit box) ahead of the house hit boxes. PRINTED REPORTS pass (all 8 + receipts checked as A4 PDFs): sections
  stacked full width (no side-by-side), KPI boxes one even row, cells never wrap (headers may), compact rows (Income fits 1
  page), scope reads "As of …" everywhere, rent-roll status = plain coloured words like the other reports, "1 day" not
  "1 days", Print / PDF disabled until the report's figures are loaded (never prints a skeleton).
- 5/10/2026: report TABLES ALIGNED (owner): side-by-side sections start on the same line (.two > .section + .section has no
  top gap — it pushed "Empty periods" down); "Where the money went" is now a plain Category | Amount table with a Total row
  (bars + "No expenses this year" note removed).
- 5/10/2026: HEALTH CHECK + fixes (owner: "fix everything"): tsc/eslint/335 tests/prod build/done-check 52/52/auth/crawl all
  clean; Vercel 0 runtime errors. Fixed: phone ☰ menu now titled MENU with PROPERTY first (the plot marker is off-screen on
  phones); sun/moon time tag shifts to stay on screen (--tag-shift in SkyTarget); login locks an address out for 15 min
  after 5 wrong tries (429, in-memory per instance); tenant hover tag = the tenant's NAME; npm audit → 0 via package.json
  overrides (postcss ^8.5.29, deepmerge-ts ^8.0.2); old unused report screens deleted (ReportsHub, AnnualStatement,
  UnitStory, RentLedgerReport, reports/charts, parts, selection). REPORTS have NO Print / PDF any more (owner) — header =
  title + year / lease / "As of" control only; rent receipts (/invoice) keep their Print button.
- 6/10/2026: PHOTOGRAPHER (owner): blue shirt, dark trousers, camera on a TRIPOD (owner preferred a stand) on the grass
  beside the hand pump by 116/B7 (plan: lane-side x − 10 ft, z = depth·0.26 — between the pump and the banana clumps,
  clear of the garden walker's loop and the manager's path). 10 s loop: looks the house over → leans in to the viewfinder
  → two shots, each a soft white FLASH sprite + a quick point light → checks the screen → turns the stand a little.
  Photographer() in People.tsx, mounted in Life.tsx (so LIFE OFF hides him). Not clickable.
  6/10 follow-up (owner): NO leaning in and NO turning the stand — he stands at the camera; every 15 s he takes TWO
  pictures (right hand to the shutter, two flashes), nothing else.
  6/10: photographer CLICKABLE (new SceneObjectKind "photographer", tag "Photographer", DIRECT) → PanelTarget "photos" →
  hud/PhotosPanel: "PHOTOGRAPHER · INTERIOR" + front unit name, 3 interior photos of 116/B7 (owner's, public/interiors/
  b7-1, b7-3, b7-4.jpg, 1200px; b7-2 door+cot photo REMOVED by owner 7/10) in a 3-column grid (desktop + phones) — just the panel of all photos, NO enlarge view (owner). The photos are
  PRIVATE: middleware matcher includes /interiors/:path* (401 without the login cookie).
- 6/10/2026: DATA cards on PHONES fixed (owner: Leases broken): card grid rows = max-content + align-content start (the
  fixed-height scroll box squeezed the cards → text spilled over the next card); phone toolbar controls start at the left
  and the main button (+ Sign lease / Add tenant / Record rent …) takes its own full-width row.

- 7/10/2026: INTERIOR PHOTOS stay the owner's REAL photos (3 after b7-2 was removed) — owner rejected stylised versions
  (ImageMagick cartoon filters and 3D-rebuilt rooms); don't re-propose.
- 7/10/2026: RENT CHANGES (owner: tenant's rent rises from October): table lease_rent_change (lease_id, effective_from =
  1st of a month, monthly_rent; unique per lease+month; migration 20261007090000). Lease.monthlyRent stays the STARTING
  rent. calculations.rentForMonth / rentForMonthIndex / rentOn: each rent month expects the latest change on/before it,
  so months paid at the old rent stay fully paid. API lease responses: monthlyRent = rent in effect TODAY, startingRent,
  rentChanges (leaseRent() in schemas/lease.ts); payment detail + receipt show the rent for THEIR month. UI: Data →
  Leases → lease drawer → "Rent changes" (starting rent, each change with ✕, inline "From <month> · ₹ · + RENT CHANGE");
  the lease form edits the STARTING rent (label "Starting rent" once a change exists); payment form "Full rent" = the
  chosen month's rent. POST/DELETE /api/leases/[id]/rent-changes[/changeId]; a change can't start in the lease's
  first month or after its last month; same month again = replaces.
- 7/10/2026: MONEY COLOURS (owner): income / money in = GREEN, expenses / money out = RED, everywhere. Done at the
  tokens: --teal is now green #4ade80 and --coral red #f05252 (names kept; also paid/occupied = green, overdue = red,
  3D rent rings via PAL.teal/coral); print reports green #15803d / red #b42318. Row amounts coloured (.pos/.neg) in Data
  Payments / Expenses / Property tax / lease drawer payments; paid tax = red (Data, tax office window, report); net cash =
  green if > 0, red if < 0 (reports netTone, charts); spending donut + expense drill rows red. Deposits stay gold, property
  value + rent rates neutral (not cash in/out).
- 7/10/2026: COMPARE TAB (dock "116/B8 vs 116/B7", UnitsCompare.tsx) made uniform (owner): unit columns in the SAME
  order as the title (back first), every ₹ exact (no ₹ L compact in Property value), net cash green/red by sign, no dotted
  "paper" underlines (the est. tag on the header stays), "Property expenses = … + whole plot" note removed.
- 7/10/2026: FORM UNIFORMITY (owner, phone + desktop): every Field = fixed 20px label row (asides like "optional" /
  "New tenant" no longer push the box down) + box + error only. NOTHING under boxes: NumberInput/DateInput hideHint now
  defaults to TRUE (no ₹ preview, no ft-in preview, no date line). DateInput draws the date in D/M/YYYY + weekday INSIDE the
  box over the native field (native text follows the browser locale, e.g. 10/07/2026; it shows only while focused). A switch
  in a field sits in a 38px row (lines up with boxes). Unit pickers show the NAME only (unitLabel). Removed label notes
  (on the street / rear wall / front to back / across the plot / entered / estimate / hex), switch descriptions, and the
  Config unit cards' "· on the street / behind the courtyard"; unit cards equal height.
- 8/10/2026: ALL TIME everywhere money is shown (owner): reports Income & expenses + Occupancy & vacancy have "All time"
  in the year picker (GET /api/reports/annual?year=all → AnnualReport kind "allTime": first record → today, `years` rows
  per FY / calendar year instead of `months`; totals = dashboard periods.allTime; tested). Dock "Income vs expenses" has an
  ALL TIME segment before the year stepper (one bar pair per year; totals periods.allTime; running net
  cumulativeNetByYear). PeriodSwitch (hud/PeriodSwitch.tsx: ALL TIME · FY · MONTH, the global usePeriod store) replaces the
  scope chip on cash sections (Property, Mailbox, House windows) and the dock "Where money went" / compare tabs.
  Data → Payments got the Expenses-style toolbar (Year incl. All time + FY/Calendar + lease; /api/payments?year=&yearMode=
  by the day received); Payments AND Expenses now OPEN on All time. Phone report KPIs = one full-width row each.
- 8/10/2026: FIVE UPGRADES (owner picked from my list, "go ahead n deploy"). All maths in calculations.ts (tested) with
  explain entries:
  1. RENTAL YIELD, last 12 months (as-of − 1 y, as-of]: rent received ÷ worth now (the owner's "yearly rent ÷ value"),
     gross and net (rent − expenses; a unit counts only its own expenses, the property counts all incl. whole plot); also
     on price paid in the report. data.yields {units, property}; keys [unit:<id>:]yield:<gross|net><Price|Value>.
     Shown: Property window value section "Rental yield" line (gross, sub "Net x%"), house window 2 cells (gross/net),
     dock compare tab 2 rows, Property value report table "Rental yield · last 12 months".
  2. COMPARED WITH LAST YEAR: ▲/▼ % chips (ui/Delta: green = good — rent/net up, expenses down) on rent / expenses /
     net cash for the year or month (same days a year earlier, lastYearScope; none for all time). data.comparisons
     {year, month} + per unit u.comparisons; AnnualReport.previous (year / custom dates). Keys [unit:<id>:]yoy:<year|
     month>:<rentCollected|expenses|netCash>, linked as "related" from each figure's breakdown. Shown: Property window
     (hero + lines), Mailbox hero, house window cells, dock income totals (past year = vs the whole year before), Income
     report KPIs (hover = last year's figure).
  3. NEXT 12 MONTHS (data.forecast): rent falling due from the as-of month on (current + incoming leases, rent changes
     included, unpaid part only) − property tax still Due (first month) − usual costs (last 12 months' expenses without
     property tax and one-offs ≥ ₹20,000, ÷ 12). Keys forecast:<rent|tax|costs|net>. Shown: Property window section
     "NEXT 12 MONTHS" (est.), Mailbox cell, new 9th report card "Next 12 months" (KPIs, month table, rent by unit, tax
     due, usual costs). Report home grid now 3 × 3.
  4. CUSTOM DATES: PeriodPicker (forms/PeriodPicker.tsx: All time · Custom dates · each FY/calendar year; From/To boxes,
     inclusive, From ≤ To kept) on Income & expenses / Occupancy reports and Data → Payments / Expenses. APIs take
     from+to (win over year): /api/reports/annual (kind "range", month rows ≤ 24 months else year rows, From can't be
     in the future), /api/payments, /api/expenses.
  5. AGREEMENT RENEWAL: Lease.agreementEndDate (migration 20261008090000; also Settings.renewalReminderDays default 30,
     Config → Settings "Renewal reminder … days before"). Lease form "Agreement ends" + "11 months" button (start + 11
     months − 1 day). Reminder = current lease whose agreement ends within the window or has ended (data.renewals):
     property manager window lists them first ("Renew X's agreement" + RENEW 11 MONTHS → next 11 months from the day
     after), lease card tag "Agreement ends in N days", lease drawer fact + renew button, house window tenant line, rent
     roll "Agreement ends" column. In-app only (no email/cron).
- 9/10/2026: FIX (owner "FIX IT"): dev-only React warning "Maximum update depth exceeded" while hovering the walking
  property manager / tenants. Cause: useRegisterSpot (estate/Interact.tsx) put the anchor's VALUES in its effect key; a
  walker's anchor is one array moved every frame, so every scene render re-registered them → setSpotVersion → another
  render (a loop). Now a hotspot registers once per key / kind / unit and its registered entry follows the latest
  anchor in place. Checked: 0 warnings in ~20 min of hover/click tests (old code: 2 in 5 min); every world object +
  the manager and tenant still show their tag and open their window (desktop + phone taps). DEPLOYED (dc37384).
- 9/10/2026: RADIAL MENU REMOVED (owner: "LETS REMOVE THIS FEATURE"): the right-click / long-press 6-slot wheel on a house
  (RENT · EXPENSE · CALL · PAY EB · TO-DO · MOVE OUT) is gone — hud/RadialMenu.tsx + radial.module.css + overview re-export
  deleted, Inspect radial state, EstateScene onUnitContextMenu + the long-press / contextmenu handlers in Interact.tsx
  removed (a click still opens the house window). Shipped with the Electricity box redesign.
- 9/10/2026: ELECTRICITY BOX (EB pole window, hud/PolePanel.tsx) = design A "METER" (owner picked A of A Meter /
  B Bill book / C Power bars / D Compact): a card per house — name + status pill, the TNPDCL consumer no. on a glowing
  dark-green LCD (11 digits shown 2-3-3-3 "06 441 008 572"; tap = copy), LAST BILL (₹ + date → the bill) · THIS YEAR
  (₹ + bills → that year's bills) · ALL TIME (₹ + bills → all bills), PAY BILL (gold, TNPDCL link) + ADD BILL (expense
  form pre-filled: that house, the electricity/utilities category, "TNPDCL bill"). Old full-width "Add a bill you paid"
  footer removed. Bills = the category's expenses for the house up to the as-of date (matches the dashboard
  composition); stacks to one column on phones. Deployed together with the radial-menu removal.
- 9/10/2026: TAX COLLECTOR replaces the bamboo tax hut (owner picked idea 1 of 6 previews — "tax collector on a moped" —
  "more realistic rather than just holding the paper all day"; renamed "Tax office" → "Tax collector" everywhere).
  estate/TaxCollector.tsx: TVS XL-style moped (dusty blue, leaning on its side stand, maroon cash box on the carrier,
  helmet on the mirror) at layout.fixtures.taxStamp, moved FORWARD to z = 7 so the default camera sees it past Unit A's
  stair; the angry policeman now guards the cash box (GUARD_AT, moped frame). The collector = UMMARANI (owner), a woman
  in a deep-blue saree + mustard blouse, bun + jasmine, cloth bag, register + pen (owner picked "woman in a saree"; a
  lap-drape limb shows the saree over the knees when seated). Routine on scene time (estate/tax-route.ts, unit tested:
  stays outside the wall, clear of the EB pole / number pole / moped / policeman on 3 plot sizes): perched side-saddle on
  the seat writing → gets up → checks the phone → walks round the front-right corner behind the EB pole, along the front
  wall to the door-number pole right of Gate A → reads it + writes (tax due: holds the demand notice up to the house,
  waits, glances at the watch; else ticks + nods) → walks back → files the register in the cash box → sits. Clickable:
  moped/policeman (key "taxstamp") + the walking collector (key "taxcollector", kind "taxstamp") → tax window.
  Hover tag "Tax collector · <name>". Tax window eyebrow "Tax collector" + contact strip (name, +91 XXXXX XXXXX, CALL
  tel: + WHATSAPP wa.me). Name + phone live in Settings (taxCollectorName / taxCollectorPhone, migration
  20261009090000; Config → Settings "Tax collector"); the owner's values go into the prod DB, NOT the repo.
  Hut code + its bamboo / thatch / office-board / round tax-stamp textures deleted. DEPLOYED (4d44196); the owner's
  name + number set in the prod Settings row.
- 9/10/2026: renamed again (owner: "JUST RENAME IT TO REVENUE OFFICER"): every label now says REVENUE OFFICER (hover tag,
  "?" tag, window eyebrow, Config → Settings section). Code / DB names stay taxCollector*, TaxCollector.tsx, tax-route.ts,
  kind "taxstamp". DEPLOYED (490a014). Then (owner): NO NAME on the hover tag — it reads just "Revenue officer"; her
  name + number show only in the window.
- 9/10/2026: PROPERTY TAX WINDOW = design D "COMPACT" (owner picked D of A house cards / B ledger / C officer's desk /
  D compact): a smaller centre window (max 760px, .taxCompact) — one slim row per house (the OLDEST bill still due, else
  the latest year: amount + "year · paid date" / "due", PAID tick or MARK PAID), then PAID IN TOTAL (+ STILL TO PAY when
  something is due) with ADD A YEAR, and the revenue officer on one line at the bottom (initial badge, name, "Revenue
  officer · +91 …", call + WhatsApp icon buttons). The old 3-column report (Summary / By unit / Year by year) is gone —
  history lives in Data → Property tax and the Property tax report. Phones: name + amount left, pill + tick/button right.

- 9/10/2026: POP-UPS = style 1 "COMPACT" (owner picked 1 of mocks 1 Compact / 2 Tabs / 3 Tiles, "LETS DEPLOY 1"): the
  house, mailbox, property and property-manager windows (like the tax box) are smaller centre windows (max 760px, property
  860px: .compactWin / .compactWide) with ONE column of slim bordered rows (bits.module.css .cw .cRow .cHero .cPerson .cOcc
  …): the main figure big with its action beside it (house: next rent or what's owed + RECORD RENT / NEW LEASE; mailbox:
  rent collected + RECORD RENT; property: net cash, worth now, next 12 months — each with its parts as clickable amounts
  underneath). The ALL TIME · year · month switch sits in the TITLE BAR (HudPanel `tools` slot; it drops under the title
  when the window is narrow — .panel is a size container "hudpanel", compact rows adapt by @container too). House:
  tenant row with call + WhatsApp icon buttons (ContactButtons in UnitPanel), 3 cash cells, value rows (worth now, gain
  on invested, gross + net yield), occupancy bar + vacant days / rent lost, electricity row; Add expense / Move out at the
  bottom (best-offer line, LVL badge and section scope chips dropped there). Mailbox: who pays next rows + latest 4
  receipts + "All receipts ›" (/data#payments). Property: ledger badge beside the title, LVL badge kept on worth now.
  To-dos: count + late badges beside the title, list full width, Add a to-do at the bottom. Every figure still drills down.
- 9/10/2026: PAY BILL button (owner: "should match in all sections how it's in the EB pole"): the house window's electricity
  row now has the SAME gold "⚡ PAY BILL ↗" button as the EB pole window — one shared PayBillButton (UnitPanel.tsx) used
  by both; disabled when no pay link is saved (the house row used to hide it). Old grey "Pay electricity" link (.payLink)
  removed.
- 9/10/2026: PHOTOS window = design D "NO BOX" (owner picked D of A film strip / B polaroids / C picture wall / D no box;
  "no need 116/B7 written in this"): no gold frame, no eyebrow / title (the unit name is gone; alt text "Interior photo
  N"), the 3 photos float over a deeper shade (.centreShadeDeep, 0.8) with rounded corners + a soft shadow, only 📌 / ✕
  as round gold-ringed buttons top-right (HudPanel `bare` prop → .panelBare); 3 across on desktop + phones; the row's
  width is capped so the photos always fit between the top nav and the dock.
- 9/10/2026: RENT RECEIPT = design D "MODERN" (owner: "should look like a real professional receipt"; picked D of A
  classic / B formal / C receipt book / D modern, "remove the footer details and pattukkottai below the heading"):
  white paper, brand in small gold capitals, "Rent receipt" + "Receipt PE-…" (no town), AMOUNT PAID · DATE PAID ·
  PAID BY boxes (label · value rows on phones), SUMMARY = the month's rent · Paid earlier (only when any) · Amount paid
  · "Balance for <month>" (or "Extra paid" when over) — calculations.receiptMonthFor (earlier = an earlier date, or the
  same day with a lower invoiceSeq; later payments never change an old receipt; tested) → InvoiceData.month; amount in
  words; FROM (tenant + phone as +91 XXXXX XXXXX) · PROPERTY (unit, address + town unless the address already names it);
  owner's signature line (+ revenue-stamp box for cash > ₹5,000). NO footer (deposit line, brand + number), NO dark
  band. One typeface on the receipt (Manrope; figures tabular via .rcNum, not the display-font .num). Old style-C (.cr*)
  and older (.receipt …) receipt CSS removed. Prints on one A4 page.
- 9/10/2026: receipt page on PHONES (owner: "bring the print button down aligning with the heading"): "← Payments" on its
  own line, then the receipt heading (RENT RECEIPT / PE-…) with PRINT / SAVE PDF beside it on the same row (the toolbar
  is a grid on phones: back · title + actions; the number ellipsizes if ever too long). Desktop unchanged.
- 9/10/2026: TENANT ≠ HOUSE WINDOWS (owner: "when you click the tenant and the house the same pop up box shows up …
  divide it"; approved my split with "deploy"): clicking the TENANT opens its own window (hud/TenantPanel.tsx, PanelTarget
  kind "tenant"): eyebrow "Tenant · <house>", title = name + rent-state pill; row = house name (→ house window) · since ·
  rent · deposit · agreement · phone + call / WhatsApp; the next rent big with RECORD RENT (or what's owed); what's owed
  month by month (days late, part-paid, late fees — each opens the breakdown). The HOUSE window keeps the house: a "who
  lives here" row (name · since · rent-state pill · ›) that opens the tenant window, rent collected / its expenses / net
  cash, value, occupancy, electricity, Add expense / Move out; empty → "Empty since …" + NEW LEASE. Mailbox "who pays
  next" rows open the tenant window. A tenant target whose house has no current lease falls back to the house window.
- 9/10/2026: UNIFORM DATA TABLES (owner: "the text and tables are not uniform here, pls check and fix" — Property tax):
  ui/Table.module.css — every cell (names, dates, years, amounts) in ONE font / size / weight (the body font; numbers
  only tabular + right-aligned, colours stay green / red), the table-wide `.num` display font is neutralised inside
  cells, the AMOUNT header looks like every other header, the sort arrow sits AFTER the label in every column; the
  property tax year is no longer bold; Payments receipt numbers in the row's font. All Data tables + Config categories.
- 9/10/2026: STREET LIFE FIX (owner: "a random person standing next to the tenant … too close … facing random
  direction"): where everyone on the grass is now comes from estate/street-life.ts (pure; tested in
  __tests__/street-life.test.ts — 2 h of scene time on 3 plot sizes, front house occupied / empty: nobody stands within
  4 ft of anybody, nobody walks through someone standing, nobody stands on a kolam, passers-by take turns). Passers-by
  (umbrella man, saree lady, lungi man) take TURNS on ONE track (CROSS_Z −4.6 ft), each stopping once to look at the
  houses: umbrella man right of Gate A (clear of the revenue officer at the number pole), lungi man left of it (between
  the dog and the tenant), saree lady at the TO-LET board when the front house is empty. The tenant WAITS BESIDE the
  gate (front: 3 ft left of it, lane gate: towards the front) facing it — never on the kolam. The stray dog NAPS off the
  front-left corner (no more trotting across the front). Garden stroller's stops moved to the far side of her loop
  (off the property manager's lane walk). gateSign / kolamCentre / tileXRange live there too; /lab?debug=1 exposes
  window.__peEnv (scene clock) for checks like this.
- 9/10/2026: DOG FAMILY (owner: "remove the dog from front and keep 1 big dog here and 2 babies with it … on the side
  of the property"): the front stray dog is GONE; a big fawn MOTHER dog lies sphinx-style on the lane-side grass
  (dogFamily: lane x − 9.4 ft, z = depth × 0.485 — below Gate B's kolam, between the banana clumps, inside the garden
  stroller's loop), facing the front; head turns to follow the pups, tail sweeps. Her 2 PUPS (one fawn, one cream) nap
  against her right flank, wake, trot out, play-bow, chase each other round her (zoomies), then flop down again — a
  54 s cycle on scene time (pupAt / motherLook in street-life.ts, tested: never through her, ≤ 3.2 ft from her, nobody
  stands in them). Lungi man's "left" stop now = halfway between the property manager's front-left corner and the
  waiting tenant. DogFamily in People.tsx (not clickable). CLOTHES LINE (owner: "remove the clothes hanging from the
  house in the back"): the terrace washing line shows on the FRONT house only (116/B7); none on the back house (116/B8).
- 10/10/2026: QUALITY MAX (owner: "max the quality … smooth on my phone and laptop … ultra HD … deploy it"). Same look,
  sharper + smoother; nothing functional changed:
  • 3D resolution = the screen's own sharpness (up to 2× laptop, 2.5× phone; was capped 1.5 / 1.25 / 1.75). PHONES now get
    the "mid" world + post effects "lite" (bloom, hover outline, tone, vignette, SMAA; they had none) — tiers: desktop hero
    high/fx full (AO + tilt-shift too), preview + tablets + phones mid/fx lite, forced low = no composer + MSAA.
  • GOVERNOR (EstateScene, drei PerformanceMonitor bounds 50–57 fps, starts 2 s in): under ~50 fps → resolution down
    (jumps straight to ≈ what reaches 60 fps, never below 1×), then effects full → lite → aa; steady 60 → back up ¼ step;
    after 3 up/down turns it stops going UP (never stops going down). Off in automated browsers (navigator.webdriver) so
    screenshots show full quality; lab param gov=auto|on|off, prop `governor`.
  • PACER: frameloop="never" + advance() from our own rAF: 60 Hz screens draw every refresh, 120/144 Hz every other one
    (steady 60–72 fps, half the GPU work), 90 Hz every refresh; stops off screen / tab hidden.
  • SHADERS: no stall on the first hover any more — the hero's first 2 frames (under the arrival cover) put every hotspot
    in the outline selection (SceneApi.warm), and frame 2 runs gl.compileAsync on the whole scene (hidden things too).
    Static world parts are React.memo'd (TileM, PalmsM, LifeM …) so a hover re-renders only houses / labels / hotspots.
  • SHARPER: shadows 4096 (radius 5) on the desktop hero (2048 elsewhere, 1024 forced low); every canvas texture painted at
    2× (textures.ts SHARP; glow/blob sprites 1×), anisotropy 16, fine per-pixel grain on ground (7 %) + plaster (3.5 %).
  • LOGIN MAP: land / water / roads / generated streets + buildings now painted on a <canvas> under the SVG
    (login/map-painter.ts): one vector render of the view + 25 % margin, moved/scaled by a CSS transform between redraws
    (redraw past ±30 % zoom or out of the margin, plus once exactly at rest; ≤ 16 M px, ≤ 2.5×) — the title drift / flight
    no longer re-draw ~25,000 SVG segments a frame (~8× the frame rate in tests). The SVG keeps plot + labels + pin; its
    copy of the base layers (data `base` group) only shows until the canvas has drawn. Map data + generator moved to
    login/town-data.ts (pure). Street-level buildings no longer sit on streets or on each other (blocker(): street
    half-widths 1.7 / 2.3 / 3.4 / 4.9 + oriented-box checks; packed a little tighter) — tested in
    login/__tests__/town-data.test.ts.
  • Unused Noto Sans Tamil web font no longer downloaded (layout.tsx).
- 10/10/2026: PAYMENT REF NO. (UTR) (owner: "add a section from now on to record ref no. or UTR number … in a clean
  manner"; "it should show up in the receipt as well"; "deploy it"). Payment.reference (nullable, migration
  20261010090000): spaces dropped + capitals (zPaymentReference, ≤ 40 chars, tested). Record rent form: "Ref no. (UTR)"
  box only when UPI / Bank is picked (not kept for Cash). Data → Payments: "Ref no." column after Paid by (faint — when
  none; phones add it after the method on the row's 2nd line); payment drawer "Ref no." row — the number + pencil, or
  "Add" — edited in place (PATCH /api/payments/[id] {reference}: the ONLY part of a payment that can change later; the
  old "Payments can't be edited…" note removed). Receipt: "Ref no. …" under PAID BY (InvoiceData.reference). The owner
  fills in the old payments himself. No search box (kept clean).
- 10/10/2026: PROOF FILES (owner: "upload real expense bill, payment ss and deposit ref no statement, and bank statements
  attach to the transaction … basically attach images with transactions"; plan approved with "go"). Table attachment
  (exactly one of payment / expense / lease = its security deposit / property tax — CHECK attachment_one_owner; migration
  20261010120000) + Lease.depositReference ("Deposit ref no. (UTR)" in the lease form under Security deposit, a fact in
  the lease drawer; tidied like the payment ref — zReference in validation.ts). Files live in a PRIVATE Vercel Blob store
  (lib/files.ts: BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID; dev/tests → .data/files, gitignored; on Vercel with no store →
  503) and reach only the signed-in owner via GET /api/attachments/[id] (?v=thumb preview, ?dl=1 save; private long cache,
  nosniff). POST /api/attachments (multipart, ≤ 4 MB, ≤ 20 per record): the first bytes decide — JPEG / PNG / WebP / PDF
  only; names cleaned, random storage keys (attachment-rules.ts, tested). Photos are redrawn in the browser to a JPEG of
  ≤ ~4.2 MP + a 360 px preview (proof/prepare.ts + image-fit.ts, tested — right way up, location data dropped).
  UI (components/proof): PROOF row = thumbnails + dashed "+" tile (phone: camera / photos / files; desktop: drop files) in
  the payment, expense, property tax drawers and DEPOSIT PROOF in the lease drawer (deposit > 0); the automatic
  property-tax expense has none (its proof goes on the tax entry — API refuses it). "Proof" picker in Record rent + Add
  expense (also in the ⌘K / 3D-window pop-ups), uploaded right after the record is saved. Full-screen viewer: ‹ › / arrow
  keys / swipe, round gold Save · Open · Delete · Close; PDFs show a card with OPEN PDF. 📎 (+ count) column before the
  amount in Data → Payments / Expenses / Property tax (phones: after the row's first line). Deleting a payment / expense /
  tax year / lease removes its files too. DEPLOYED 10/10/2026 (owner: "DEPLOY"; 306ab0b) + the PRIVATE Blob store
  "pattukottai-proofs" (store_wGJkc3Lr4hRVqDuW, region sin1, access private, connected to the project for production /
  preview / development → env BLOB_READ_WRITE_TOKEN), then redeployed so the site has the key. Hobby plan: 1 GB storage
  + 10 GB transfer a month included, never billed (over the limit Blob pauses for 30 days).
- 10/10/2026: ATTACHMENT (owner: "RENAME IT ATTACHMENT AND JUST KEEP A CLEAN CLIP ICON TO BE PROFESSIONAL"): every
  "Proof" label now says ATTACHMENT (drawer sections, the Record rent / Add expense field, the 📎 column's title) and the
  lease's is "Deposit attachment"; the dashed "+" image tile is replaced by a clean gold PAPERCLIP button (44 px, no
  border, soft gold tile on hover — proof.module.css .attach), centred on the thumbnails; with no files yet the clip lines
  up exactly with the heading. Thumbnails now load at once (no lazy loading inside drawers).
- 10/10/2026: PAYMENTS = CLIP ONLY (owner: "dont like this design" → "would the clip near next to the ref no. look
  good?" → "CAN WE PLACE THE CLIP WITHOUT THE PDF FILE BEING VISIBLE" → "DEPLOY"): no ATTACHMENT section and NO
  thumbnails on payments — just the gold 📎 (proof.module.css .clip, + .clipCount): Record rent = inside the Ref no.
  (UTR) box at its right end (Input suffix) for UPI / Bank, beside CASH · UPI · BANK for cash; payment drawer = after
  the ref no. + pencil (or "Add"), on the Paid by line for cash without a ref. No files → tap opens the picker; files →
  the clip shows the count ("📎 2") and opens the full-screen viewer, which now has an ATTACH MORE button (round 📎)
  and works for files picked before saving too (local object URLs; ✕ removes without asking). Components ProofClip
  {owner} / PendingProofClip {pending}; ProofViewer takes ViewItem[] (viewItem(dto)) + onDelete / onAttach.
- 10/10/2026: CLIP ONLY EVERYWHERE (owner: "OK" → "DEPLOY"): expenses = the clip in the bottom-right corner of the
  "What was it for?" box (Textarea `suffix` prop, add + edit; none on the automatic tax expense) and after "What for" in
  the expense drawer; property tax = after the paid date ("Paid on") in its drawer; deposit = inside the "Deposit ref
  no. (UTR)" box in the lease form (sign: picked files upload after saving; edit: uploads straight away) and after the
  deposit ref no. in the lease drawer. Every ATTACHMENT / Deposit attachment section and thumbnail row is gone —
  ProofStrip / PendingProofStrip deleted; components/proof/ProofClip.tsx holds ProofClip, PendingProofClip,
  usePendingProofs, ProofMark, ProofHead, proofCount. (Photos still get their 360 px preview stored; nothing shows it now.)
- 10/10/2026: NO CASH (owner: "REMOVE CASH IN PAYMENTS, WILL NEVER RECEIVE CASH" → "DEPLOY THAT"): Record rent offers
  UPI · BANK only (UPI picked by default) and the Ref no. (UTR) box + its clip always show. The API refuses new cash
  (and "other") payments: paymentCreateSchema method = RECEIVED_BY ["upi", "bank"], default "upi" (tested). Prod had
  no cash payments (27 UPI, 1 bank); PAYMENT_METHODS / the DB enum / METHOD_LABEL / the receipt's cash revenue-stamp rule
  are kept so any old cash record still shows. Demo seed no longer makes cash payments.
- 11/10/2026: UNIFORM REPORT TABLES (owner, Occupancy & vacancy screenshot: "why does the columns and rows not uniform,
  recheck also the font size … neat n clean" → "DEPLOY"): every report table (rlib .table) = table-layout FIXED with
  planned widths — equal columns, or TableBox `cols` weights (rent roll, forecast rent by unit, tenant statement
  receipt, yields, deposits); EVERY cell body font 14px weight 400 (bold only in tfoot totals; the bold first column
  `.strong` is gone), cell children inherit the font, row height 44px, head 38px; status words = plain coloured words
  in the row's font (the Rajdhani `.status` class is gone); rent roll "ends in N days" sits on the date's line; the
  small gold labels (figure-box label, section title, column head) are all 11px / 0.18em. Phones keep the card rows.
- 31/10/2026: GLASS + ONE LIVING WORLD (owner: reel "Glassy Dashboard V5" — "buttons … glass … very smooth", "i dont
  want to change the current layout", then a video: "make all sections glass and so we can see the background at all
  times even the overview to data, back to overview rn theres a loading screen" → "deploy"). Layout unchanged.
  • GLASS tokens in globals.css: buttons --glass-bg / -edge / -blur(16px) / -shine / -shadow, chosen = --glass-gold
    (gold kept, not white); sections --glass-panel-bg (tint .64) and --glass-deep-bg (.76) with --glass-panel-blur
    (22px); solid tints when backdrop-filter is unsupported or prefers-reduced-transparency. Applied to: float nav
    pill, Data/Config section buttons (RailScreen .item + count badges), chart dock + tabs (deep glass while a chart is
    open), Life button, phone bottom bar (its chosen tab = a sliding gold-glass pill instead of the top line), the
    Data/Config game panel ([data-game-main]), tenant/lease cards, Modal dialogs + side drawers, overview windows (hud
    .panel). Buttons press to scale .95–.96 and spring back (--press); every sliding highlight = one spring (380/34/.9),
    the Data/Config sections got a sliding gold plate too (RailScreen .plate, layoutId).
  • ONE WORLD: AppShell mounts <Overview> once (first visit to /, /data or /config) in a .world layer under <main>
    (.stage); "/" page renders null. Overview `active` = on "/" (and not mid-exit): inactive → HUD / windows / sky /
    tour / help / leave prompt / phone chart menu unmounted, hotkeys + ⌘K commands (useOverviewCommands enabled) +
    dock keys off, windows reset (comes back clean), camera insets frozen, scene `paused` (new EstateScene prop → the
    Pacer stops; the last frame stays) once its first frames are drawn, layer pointer-events none, canvas brightness
    .82. Arrival cover only when active (first load). world-state.ts: worldState (ready → RailScreen's stand-in
    estate picture fades out), isWorldRoute, pageExit. Other routes (invoice, lab …) hide the layer.
  • MOTION: main tabs (HudBar + MobileTabBar → smooth-nav.ts useSmoothNav) dissolve the page (pe-dissolve 170ms:
    fade + blur 8px + scale .99) then router.push; Data/Config section buttons and the section panel fade in from a
    blur (pe-materialize, 30 ms apart, panel +80 ms, replays on section switch), cards a beat apart; fill-mode
    backwards so press / fixed children still work. Reduced motion → instant.
- 31/10/2026 (later): GLASS V2 = COPY THE REEL EVERYWHERE (owner: "the opacity and glass look hasnt been matched to the
  video … go for the same look without the orange borders", "copy the video for the tabs and button", "copy that design
  for everything and everywhere"; answers: main buttons BLUE like the reel, lettering = the reel's plain modern font in
  normal letters). Layout unchanged except the chart dock (below). Preview branch pending/glass-v2.
  • TOKENS (globals.css): neutral charcoal surfaces (no warm tint), white hairlines, --marigold is now the reel's BLUE
    #4c8dff (name kept so every accent followed), --marigold-ink white, --marigold-bevel / --accent-bg = blue pill,
    --pill-on white + --pill-on-ink dark (chosen tab / section / segment), --glass-* = clear smoky tint .3 / blur 20px,
    --glass-panel-* / --glass-deep-* .34 / .52 + blur 28px, --glass-card-*, --glass-radius 22px, --radius 18/12/8 +
    --radius-pill. NO gold frames anywhere (#c9922e / 2px borders / corner brackets / grain / Chettinad pip gone).
  • FONT: Plus Jakarta Sans (next/font --font-ui) for --ff-display AND --ff-body — looks like the reel's font and keeps
    even-width figures (Poppins didn't: money columns wobbled). NO capitals / letter tracking anywhere (sweep removed
    every text-transform: uppercase + letter-spacing ≥ .03em in the CSS modules; "IN ADVANCE" → "In advance" etc.).
    Rajdhani stays only for signs painted in the 3D world; the printed receipt keeps Manrope (.rc overrides --ff-body).
  • APPLIED: float nav + phone bar (glass pill, chosen = white pill), Data/Config section pills + count badges, Button
    (primary blue pill / secondary glass pill / danger red glass), Panel + [data-game-main] (one big glass pane), Data
    cards (glass panes, blue initials circle, pill tags), HUD windows (glass pane, inner rows = lighter glass panes,
    blue avatars; PeriodSwitch = white-pill segment), chart dock, world name tags + sun/moon tag (dark glass pills),
    Leave prompt (glass pane; Stay glass / Drive off blue), time-travel panel, phone ☰ menu, Modal/Drawer (drawer now a
    floating glass pane inset 12px), Tabs (white pill both variants), inputs (glass fields), Toggle (round, blue when
    on), ChoiceGroup / Stepper (pill track), Badge/Delta pills (the "marigold" badge tone = amber warning now), login
    (white title, glass "Press any key" pill, glass sign-in bar with glass fields + blue Enter, pin tag = dark pill).
    Window shade lighter (.28) + world dim softer so the world shows through the glass.
  • CHART DOCK → LEFT ICON COLUMN (owner: "place the bottom section on the side like the video … just use icons"):
    Dock `side` prop — a vertical glass pill of 6 ICONS at the left middle (hud/dock.module.css .rail*; chosen = white
    circle that slides, name in a dark glass tag on hover / focus, none on the open one). Then (owner: "the side bar
    should pop up the charts in a way that suits the side bar"): the chart SLIDES OUT BESIDE the column as a glass
    panel (.sideTray: absolute, left 82px, centred on the column, width clamp(480px, 42vw, 620px), chart height
    clamp(340px, 52vh, 520px), body scrolls; x −16 → 0 fade) and counts as the overview's LEFT inset (Dock `trayRef`
    → Overview sideEl → useInsets left, quest log wins) so the camera frames the plot to its right; the charts' own
    @container dock ≤ 680px rules stack them for the narrow panel. The old labelled bottom bar is gone on desktop. The
    column + panel are position:absolute against the HUD, so the .bottom motion.div animates OPACITY only (a transform
    would trap them). Phones unchanged (☰ menu → chart sheet).
- 1/11/2026: GLASS V3 + CAR GONE (owner: "a lot of lag while switching to units, plot", "remove the black thing", "lets
  not pop up a square box instead let it appear like how its in the reel", "let the life on and off button add to the
  side bar in the end with its own icon", "remove the car model and its features", "Electricity Board - eb pole rename
  it"). Preview branch pending/glass-v3.
  • LIGHT GLASS (globals.css): every glass token is now a white frost over a MID-GREY scrim (--glass-tint rgba(70,72,84,
    .26), panel rgba(74,76,88,.3), deep rgba(70,72,84,.4), card rgba(90,92,104,.18) + white gradients .12–.14) — the
    panes read LIGHTER than the world behind them, never a black box; blur 24px. The held-still world behind Data/Config
    no longer gets a canvas brightness filter.
  • CHART = A REEL PAGE: beside the icon column the chart has NO container box — the title floats as text (22px) with
    its period control, the chart sits on ONE light frosted card (radius 24), and it arrives like a reel page (fade +
    settle y 10 → 0, scale .985 → 1; dock.module.css .sideTray*).
  • LAG FIX: pe-dissolve / pe-materialize no longer animate filter: blur (blurring a layer that holds a WebGL canvas every
    frame stalled the Config Units / Plot switch) — fade + settle only. Config LivePreview mounts its 3D scene 380 ms
    AFTER the section has painted (useState ready + setTimeout) at quality "low" with life off (it only shows dimensions).
  • LIFE SWITCH in the side bar: estate/life-state.ts (lifeSwitch store + useLifeChoice) shared by EstateScene (was local
    state; `hud` is off on the overview) and the Dock rail — a hairline, then the PersonStanding icon (white circle while
    on, tag "Life on / off" always on hover).
  • CAR REMOVED: LandCruiser.tsx deleted; ParkedCar + arrival path + LEAVE_EVENT gone from Fixtures.tsx; kind "car" gone
    from both SceneObjectKind unions, Inspect (tag, hint, card, onLeave prop), HelpOverlay, EstateScene hints. SIGN OUT =
    the LAST icon of the side bar (LogOut, Dock `onLeave`) → the same "Leave Pattukkottai Estates?" prompt (Stay glass /
    SIGN OUT blue, LogOut icon; Enter/Y · Esc/N) → "Leaving the estate…" fade → logout after 1.4 s (was 4.6 s for the
    drive-off). ⌘K "Sign out" unchanged.
  • RENAME: "EB pole" / "Electric pole" → "Electricity Board" everywhere the owner sees it (hover tag, "?" tag, window
    eyebrow "Electricity Board · TNPDCL", hint). Code names (pole, PolePanel) unchanged.
  • Last dark boxes lightened too: Config → Units slot cards (glass card, white ring when chosen), house window cash cells
    (.mini → rgba(255,255,255,.05)), Data table header + total band (rgba(62,64,74,.82–.86) + blur 16px), --panel-glass
    (3D labels / preview chips) rgba(56,58,68,.62).
- 1/11/2026: side bar icons have NO hover name tags any more (owner: "remove these guide" → "deploy"): .railTag spans +
  styles deleted from Dock / dock.module.css; each icon keeps its name as aria-label only.
- 1/11/2026 CLEAN-UP (owner: "remove those blue edges looks broken, fix that black bars - remove them, remove scrolling
  bar, and those dark grey bar on the tables looks broken and the colors on text is almost not visible" → "deploy these";
  + "press any key to start bar should be shaped like this instead of a pill"):
  • blue corner marks gone (Config live-preview frame ::before, help / tour card ::before); preview frame = glass edge +
    radius 22.
  • every dark rgba(0,0,0,.05–.24) BACKGROUND in the UI modules (form action strip .inlineActions — the bar under "Save
    unit" —, window wells, drill/explain rows, chart rows, Modal foot, ⌘K foot …) → rgba(255,255,255,.05).
  • NO SCROLL BARS anywhere (globals: scrollbar-width none + ::-webkit-scrollbar display none); scrolling still works.
  • tables: header + total row are plain transparent rows with a hairline that scroll with the list (no sticky bands — a
    clear sticky row let rows show through).
  • text tokens brighter for the light glass: --text #fff, --text-dim #e1e3e8, --text-faint #c2c5cd (hex codes, zeros,
    eyebrows readable).
  • login "Press any key to start" = the sign-in bar's pane (glass-deep, panel edge, radius 28, padding 20/44) — not a pill.
- 1/11/2026: SIDE CHART = ONE RECTANGLE (owner: "a rectangular bar … using the side bar as the guide for height and lets
  not zoom out … just pop up on the side" → "deploy all of these"): Dock side mode wraps the icon column + the chart in
  one flex row (.side, absolute at the left middle, align-items stretch, gap 12); the chart is ONE light frosted
  rectangle (.sideTray: glass-panel, radius 24, width clamp(520px, 44vw, 680px), title + period control inside) whose
  height = the column's (its content sits in an absolute layer, so a tall chart scrolls inside and never stretches the
  column); it slides out (x −12 → 0, fade, .24 s) — no scale. It is NOT an inset any more (Overview sideEl / Dock
  trayRef removed), so the camera never moves for a chart. Chart tables (payments list) have no dark sticky header band.
  Login map pin tag: the name is centred in the pill (text-anchor middle, dominant-baseline central).
- 1/11/2026: MINIMAL + YEARS ONLY + GLASS DROPDOWNS (owner: "keep years to select clean and simple … no need of all time and
  custom date, remove the months", "drop downs should match the website", "keep the website minimal … like the EB pole and
  revenue officer" pop-ups, "remove the eg in notes"). DEPLOYED 1/11/2026 (owner: "deploy"; 2d12099).
  • DROPDOWNS: every <Select> opens a glass list (ui/SelectMenu.tsx), never the OS menu: groups as faint headings, chosen =
    white pill + ✓, keys ↑ ↓ Home End Enter Space Esc + type-to-jump; Esc closes only the list (window-capture listener runs
    before a dialog's trap); outside tap closes. The <select> stays (value, name, label, change events) with pointer-events
    none, so phones never open the OS picker; the empty "Choose a …" prompt is not listed.
  • YEARS ONLY: PeriodSwitch = a year dropdown (windows + spending / compare charts); an earlier year shows the estate as at
    the end of that year (the overview's as-of, AsOfContext in hud/year-jump.ts), the current year = today. usePeriod is
    always "year" (a remembered All time / Month is ignored); ⌘K period commands removed. PeriodPicker = years only (reports,
    Data → Payments / Expenses, which now open on the current year). Income chart: the same dropdown, no All time / stepper.
    The APIs still accept year=all and from/to (nothing in the UI sends them).
  • SIDE CHART: header = title (+ year dropdown on spending / compare) — no scope chip, no "Ledger balanced", no line.
    Payments chart lists the latest 20 (calculations recentPayments); the overdue note line is gone.
  • CONFIG PREVIEW: the empty hint chip (grey square, top-right) is gone; "Showing <field>" only while a field is focused.
  • DATA TABLES = the report tables (owner's OK): fixed layout on wide screens, 14px / 400 cells, 44px rows, 38px head,
    plain hairlines (no zebra, no blue rail), sorted header white; total row = "Total" + amount only (no scope chip / count);
    Config → Categories total without "All time"; receipt links without underline.
  • WINDOWS (EB / revenue officer are the model): tenant = house name + call / WhatsApp only (no since / rent / deposit /
    phone line; an agreement line only when renewal is due), "Owes" / "Next rent · Month"; house = tenant name + pill,
    Worth now / Gain / Gross yield / Net yield (no offer / est. tags, no "last 12 months"), Occupancy, Consumer no.;
    mailbox = Rent collected + "Overdue · Monthly rent"; property = Net cash (Rent · Expenses), Worth now (Gain · Yield), Next
    12 months (Rent · Costs · Tax), Occupancy — no est. / offer tags, no ledger badge; manager = "Property manager / To-dos"
    with only an "N late" badge. Paper values are no longer dotted / tagged in the windows (owner's minimal call).
  • NO dotted underlines or dashed lines anywhere in the UI (faint solid hairlines); green / red money gets a soft text shadow.
  • FORMS: no example placeholders ("e.g. …", sample names, phones, emails, amounts, addresses); "Choose a unit" prompts and
    "0" defaults stay.
- 1/11/2026 (later): owner round → "deploy all these changes mentioned":
  • "Where money went?" (heading now with the question mark): the side chart puts the ring on the LEFT and the category
    list on the RIGHT (no dead space at the sides); the ring grows with the panel (clamp 168–210 px via cqi); it only
    stacks (ring above list) when the chart is ≤ 460px wide (phone sheet).
  • FILTER PILLS → DROPDOWNS (owner: "makes these into a drop down"): Data → Leases (Current · Incoming · Past · All leases),
    Property tax (All years · Due · Paid), To-dos (To do · Done · All to-dos) use the glass Select; the counts left the
    labels (the section buttons already show counts). FY / Calendar stays a two-way switch.
  • DROPDOWN LISTS STAY INSIDE THE PAGE (owner: "dont let me go outside the page"): SelectMenu bounds = the nearest
    [data-menu-bounds] / dialog / [data-game-main] / [data-centre-panel] (HudPanel + the side chart carry data-menu-bounds);
    the list lines up with the field's left edge, or its right edge when that would cross the panel, is never wider than
    the panel, and opens upward when there's more room above inside the panel.
  • LEVEL BADGE (owner: "re design this to fit the website layout"): no metal hexagon / moving shine — a small frosted
    rounded box (ui/LevelBadge: "Level" in grey, the multiplier in white, red when below cost).
- 1/11/2026 (later still): TO-DOS + ICON BUTTONS (owner: "remove this dropdown … show at all times all to dos but keep the
  pending ones on top always"; "over here just keep icons" + "also for config"). DEPLOYED 1/11/2026 (2886bc4).
  • Data → To-dos: no filter dropdown; the list always shows every to-do — the ones still to do first (by due date, then
    priority), done ones after — and stays that way when a column is sorted (ui/Table `group` prop: rows keep the group
    order, the column sort applies inside each group). Footer "N to do · M late".
  • Data + Config section buttons (RailScreen) = ICONS ONLY: round 44px glass buttons (40px on phones), chosen = white
    circle; the name is the button's aria-label + hover tooltip; no words, no count badges.
- 1/11/2026: NO "optional" LABELS (owner: "only remove optional label keep the other one"): every Field aside="optional"
  removed (expense / offer / tenant / settings / lease / move-out / to-do / unit forms); required fields keep their blue ✱.
  The ▲ / ▼ % vs-last-year chips STAY (owner). DEPLOYED 1/11/2026 (f58806e).
- 1/11/2026: PROPERTY TAX filter = Due · Paid only (owner: "just show paid and dues not all years"); "All years" removed.
  It opens on Due when any year is due, else on Paid. DEPLOYED 1/11/2026 with the loading ring + Premises.
- 1/11/2026: LOADING SCREEN = a plain BLUE RING, no words (owner, after mocks A frosted card / B site plan drawing /
  C floating island / D ring + name: "lets do a basic blue circle loading without any words"): .pe-spinner in
  globals.css (48px, 4px border, blue arc ¾ … ½ turn, 0.9 s spin; slower for reduced motion) on the dark background — the
  overview arrival cover and the sign-in hand-over ("Arriving at your estate…" text + bar removed). DEPLOYED 1/11/2026.
- 1/11/2026: "PREMISES" replaces "Whole property" / "Whole plot" / "Whole plot (shared)" everywhere the owner sees it
  (owner picked it from a list; "All units" stays as the filter's everything option): expense "For" box + Expenses filter
  + tables + drawers, to-do "For", drill-downs, compare note, report / dashboard rows (unitName "Premises"), explain
  notes ("premises expenses"). Code names stay (WHOLE_PLOT, unitId null). DEPLOYED 1/11/2026.
- 1/11/2026: SIGN-OUT cover = the same blue ring (owner: "even this should be the blue loading circle"): "Leaving the
  estate…" text removed; .leaving shows .pe-spinner until logout. Then (owner: "the blue circle should load behind a
  background like this not black screen", pointing at mock A): every loading cover (overview arrival, sign-in hand-over,
  sign-out) gets .pe-loadbg (globals.css) — the estate picture (public/estate-backdrop.jpg) blurred 26px, dimmed .62,
  slowly drifting (14 s; still for reduced motion) behind the ring; the ring's track is white .22 + a soft shadow.
  DEPLOYED 1/11/2026.
- 1/11/2026: CONFIG LIVE PREVIEW turns on like a CCTV camera (owner: "when both the live preview load make it look like a
  cctv is turning on"): Preview.tsx overlays (.cctv* in config.module.css) — black, a white line across the middle that
  opens into grey static (moving noise tile + scan lines + a rolling light bar) until EstateScene's onFirstFrame, then the
  static clears with a quick soft flash, scan lines fade a beat later and the picture warms from black-and-white into
  colour (a saturation-blend overlay fading out — no filter on the canvas). Replays on every Units / Plot visit; reduced
  motion = no line / static. DEPLOYED 2/11/2026 (4bcfb2c).
- 1/11/2026: CHART OPENING ANIMATIONS (owner: "when any charts like the bar graph or pie chart open make have an
  animation"), CSS only in charts.module.css: bars grow from the zero line one after another (.bar, --i stagger 32ms;
  negative bars grow down), the income net line draws itself (pathLength 1 dash) and its dots pop in, the "Where money
  went?" ring is revealed by one clockwise sweep (SVG mask circle, stroke-dashoffset 100 → 0) with the centre fading and
  the list rows rising in, occupancy timelines grow left → right, payments / compare table rows rise a beat apart. Each
  chart remounts when its tab opens; picking another year replays it (svg keyed by year). Reduced motion = none.
  DEPLOYED 2/11/2026 (4bcfb2c).
- 2/11/2026: CONFIG PREVIEW = CCTV FOOTAGE (owner: "instead of live preview make it look like a cctv footage with date and
  time"): the "Live preview" chip is gone; once the picture is on (after the power-on) the preview carries a camera's
  on-screen display in white monospace with a hard shadow, no boxes — the property's date + time (IST, ticks each second:
  "02-11-2026 MON 05:29:21") top-left, a blinking red ● REC top-right, "CAM 01" bottom-right — plus faint scan lines and
  a vignette (.cctvFeed) and a slight wash (the colour tint stays at .16). "Unsaved" / "Showing <field>" chips sit under
  the clock. Preview.tsx (useCctvClock / cctvStamp) + .osd* in config.module.css. DEPLOYED 2/11/2026 (4bcfb2c) with the
  CCTV power-on + chart animations (owner: "deploy").
- 2/11/2026: CCTV CAMERA replaces the PHOTOGRAPHER (owner: drone mocked first → "no need drone", "replace the cctv for the
  camera man so remove him", then his photo of a street PTZ dome: "a real looking small sized cctv on the eb pole on the
  left will look good"): estate/CctvCam.tsx — a white PTZ DOME camera (white domed housing, grey band, glossy smoked black
  dome underneath) hanging from a curved white arm clamped halfway up the LEFT EB pole (fixtures.poles[1], off the lane
  corner — not a hotspot, so no clash with the Electricity Board pole), steel straps + a grey junction box behind; real
  size-ish (small; then 25% smaller — owner: "a bit smaller", K = 0.75 in CctvCam), the arm out over the lane-side grass (clear of Gate A, its kolam and the waiting tenant), static (no
  LED). Mounted in Fixtures (scenery: stays with Life off; the photographer lived in Life). Same hotspot (kind / key
  "photographer", generous pickFirst click box round the dome) → the interior photos window; hover / "?" name "CCTV".
  Photographer, tripod, flash + photographerSpot (and its street-life test entry) deleted. Earlier tries (bullet camera on
  a lane-wall pillar; drone) dropped. DEPLOYED 2/11/2026 (owner: "deploy but … a bit smaller").
- 2/11/2026: GROWTH chart (side chart "Growth", GrowthChart.tsx): the price-per-sqft total row (both houses together,
  data.kpis) is called "OVERALL" (was "Property"; owner first asked for "Premises" — not used: Premises = shared costs of
  neither house, so it would mean two things; owner picked "Overall"). Checked against prod: running net cash 2024
  +₹4,000 → 2025 +₹87,400 (₹91,400) → 2026 so far −₹16,080 (₹50,000 rent − ₹66,080 costs) = ₹75,320. DEPLOYED 2/11/2026.
- 2/11/2026: NO NAV ON THE LOADING SCREENS (owner: "dont let the top option bar come in the loading page"): the floating
  Overview · Data · Config bar (HudBar) hides (data-covered: opacity 0 + visibility hidden + inert) while the overview's
  arrival screen is up on "/" (also during the server render, so it never flashes) and during the sign-out screen, then
  fades back in (0.5 s). Flags in shell/world-state.ts: arrivedFlag (mirrors Overview `arrived`, reset on unmount so a
  sign-in after a sign-out hides it again) + signingOutFlag (Game `leaving`); useCovered(pathname). Phones' bottom bar
  unchanged (it is part of the layout — hiding it would leave an empty strip). DEPLOYED 2/11/2026 (owner: "deploy").
- 2/11/2026: PROPERTY MANAGER = A ROVER (owner: "can we replace the property manager to this space robot" + a Mars rover
  picture; then "not only circle around the property but also stop in some place and do more natural things like he's
  looking around the property even the plants"). estate/Rover.tsx replaces the walking man (PropertyOfficer + officerLimbs
  deleted from People.tsx): six wheels with orange rims + cleats on rocker-bogie legs, gold body, solar-cell deck (canvas
  cell texture) with flared wings, white camera mast + camera bar (pans / tilts), gold dish antenna, radio rod, an
  instrument ARM (shoulder / elbow / turret) folded across the front. ~2.1 ft wide (SCALE 1.05). Same hotspot (kind / key
  "noticeboard" → to-dos; tag "Property manager"). ROUTE (street-life.ts, tested): managerCorners — lane side 6 ft out,
  right side 5 ft out, front run 7.3 ft out (clear of both EB poles, the passers-by's track, the policeman), 1.5 ft/s;
  turns in place at each corner (2.5 s); STOPS: in front of 116/B7 (scans the façade; x chosen clear of the passers-by's
  stops), short of the right-side palm (looks up into the crown), behind 116/B8 (looks it over), and pulls OFF the lane
  road to the FRONT side of the nearest banana clump (visible from the default camera), faces it, unfolds the arm and taps
  the stem, folds, drives back on (no other lane stop: the garden stroller walks beside that road). Palm / banana spots
  moved into street-life.ts (palmSpots, bananaSpots, insidePolygon; Vegetation imports them). Street test: the rover is
  r 1.1, `stopped` (was `writing`). DEPLOYED 2/11/2026 (owner: "deploy"; size + tag kept as built).
- 2/11/2026: ROVER GOES ROUND THINGS + VISITS THE COW (owner: "the robot rn just goes through the trees and other objects
  fix that make it go around it and interact with the cow"). street-life.ts: roverObstacles(layout) = palms (r .9),
  banana clumps (1.4), both EB poles, plot marker, moped + policeman (3.4), hand pump, coconut husks, chilli mat, the
  mother dog (3 small circles along her body), the cow (3 circles, she sways). planRound(): a 0.5 ft grid over the island
  (blocked: obstacles + ROVER_R + .35, the wall zone WALL_CLEAR 4.2 — hedges —, the island rim, and the passers-by's
  front track between the front corners), A* between the waypoints (a step costs more the further it strays from the
  straight line, so it keeps its usual line and only swings round things), string-pulled, bends rounded where clear;
  `planned` says every leg found a way (tested). Stops now by arc length: front look, COW VISIT (stops in front of her
  head, faces her, nods its camera, half-lifts its arm and waves; the Cow in People.tsx reads the same managerAt: stops
  grazing, lifts her head with slow nods, turns her body up to ~0.6 rad towards it, swishes her tail faster), right-side
  palm, behind 116/B8, banana clump (pulls off from the road point beside its parking spot; clumps < 8 ft from the dogs
  skipped). No corner stops (it drives the rounded corners). The back-row palms moved back to D + 6.9 … 7.5 so a lane
  exists behind 116/B8. Tests: never into an obstacle (the examined clump excepted), the dog as her real ellipse, the cow
  visit once per round, `planned`. DEPLOYED 2/11/2026.
- 2/11/2026: REVENUE OFFICER JUST SITS (owner: "let the revenue officer just sit on the bike and move her head looking"):
  her walk to Gate A + phone / demand notice / cash-box routine is gone (collectorRoutine → collectorSeat in tax-route.ts;
  TaxCollector's `due` prop removed). She sits side-saddle on the moped (hips on the seat y −0.42, legs −0.6 / −0.52,
  saree lap −0.62, register on her lap) and turns her HEAD (new head limb, index 6, yaw on the neck) to a new direction
  every 3.4 s with eased turns. tax-route tests now check the seat (on the moped, clear of the policeman / EB pole /
  wall). DEPLOYED 2/11/2026 with the rover route + cow visit (owner: "deploy").
- 2/11/2026: REAL WEATHER (owner: "connect the real weather with my website, so its sunny, raining or dark depending on
  the real weather of pattukkottai" → "go"; defaults taken: visual only — no weather words — and a gentle real-wind boost).
  lib/weather.ts (tested): Open-Meteo forecast API (free, no key; lat 10.4235, lon 79.3197) `current` → WeatherNow {kind,
  code, overcast, rain, mist, storm, windKmh, tempC, observedAt} via lookForCode (WMO codes) + cloud cover / hourly mm;
  sampleWeather(kind) for previews. GET /api/weather (behind login): fetch with next.revalidate 900 (≤ ~4 calls an hour),
  5 s timeout, { weather: null } on any failure (= clear world). Overview fetches it (useApi, dedupe 15 min, re-checked
  every 15 min) → EstateScene `weather` prop → EnvDriver eases Env.overcast / rain / mist / storm / windBoost (k = 1 − e^−.35dt;
  instant on the first frame / reduced motion) → env.applyWeather after the time-of-day palette: sky, clouds, fog, sky
  light and sun colour go grey + darker, key light −72 % (soft shadows), stars off, sun / moon discs veiled (Env.veil;
  the HUD sun/moon target keeps its unveiled visibility so it stays clickable), lightning (lightningAt, scene time:
  bright strike + flicker in most 7.5 s windows) brightens the sky light; Lights pulls the fog in for mist / rain. Rain.tsx:
  one draw call of GPU streaks (1800 / 1100 / 500 by tier, count by rain strength, lean with the wind, hidden inside the
  houses below their roofs, fade at the ground) + splash rings on the grass; birds and fireflies keep away in the rain;
  windAt × windBoostFor(km/h) (0.85 … 1.4, amplitudes only). Lab: ?weather=clear|partly|cloudy|fog|drizzle|rain|heavyRain|
  storm. Checked live from the dev server: Pattukkottai was overcast (code 3, 26 °C). DEPLOYED 2/11/2026 (owner: "deploy").
- 2/11/2026: REVENUE OFFICER ON HER PHONE (owner: "the hands of her is not natural just holding the pen n book the whole
  day … maybe hands in pocket or just using a phone"): register + pen gone; a phone (lit screen) in her right hand, held
  up and scrolled (thumb flicks) with the head bowed a little towards it for ~7.5 s, then lowered while she looks up and
  about (LOOKS) for ~3.5 s; left hand on her lap. DEPLOYED 2/11/2026 with the weather.
- 2/11/2026: FIX year dropdown (owner: "when 2024 is selected 2025 disappears … a glitch"): PeriodSwitch built its years
  from data.monthlyByYear, which stops at the as-of year once an earlier year is picked → only that year + this year
  were left. Now hud/year-choices.ts yearChoices(now, shown, dataYears) = every year from the earliest (records / shown)
  to this year, newest first, no gaps (≤ 30 years; tested). Checked in the browser: FY 2019-20 picked → all 8 years still
  listed. DEPLOYED 2/11/2026 (owner: "deploy").
- 2/11/2026: LOADING COVERS WHITE + PILL ON ONE LINE (owner: "both loading screen while enter and exit become white
  with blue circle", "aline everything in this pill"). The three covers that share .pe-loadbg — arrival, the login
  hand-over (.travel) and sign-out (.leaving) — are plain white now; .pe-loadbg::before (the blurred, drifting
  estate photo added 1/11/2026) is gone, as is @keyframes pe-drift. That also answers the owner's "why is it so
  zoomed in": /estate-backdrop.jpg is only 960x600, so `cover` blew it up ~2.4x on a 1440px window (2.08x for width,
  then inset -48px, scale(1.06) and the drift animating to scale(1.12)) — the 26px blur hid the softness but not the
  framing. .pe-spinner's unlit track was white at 22%, invisible on white, so it is now rgba(26,29,36,.14) with the
  same blue (--marigold #4c8dff) arc. The backdrop file and its other use (RailScreen) are untouched.
  Login pill: measured live at 1440px, the inputs centred 66px from the bar's top but the Enter button only 53px —
  each field stacks a label over its input, so the input sits low in a tall column while the button was centred
  against the whole bar. .bar is align-items: flex-end now, .enter is align-self: flex-end at height 44px (an
  input's height, not 52px) and .barSep is 44px tall, so title, separator, inputs and button share one line.
  Reproduced and checked in a standalone page with the real geometry: before, input 62 / button 50; after, input,
  button and separator all 62, title block 59.6. NOT run against the real app — `npm install` is unavailable in this
  session, so this is a CSS-only change verified by measurement, not a screenshot of the built site.
- 2/11/2026: KIND / TYPE BOXES FIXED (owner: "the drop down here is broken doesnt open up list if something is input"): the
  to-do "Kind" and Config unit "Type" were text boxes with the browser's own suggestion list (datalist), which only shows
  the entries matching what's typed. Now ui ComboInput: the same glass list as every Select, tap the box / ⌄ / ↓ = the
  WHOLE list (current one ticked), typing highlights the matching row (Enter takes it), a new word is kept as typed.
  Choices = the usual ones + kinds already used in the records (prod to-dos have Renovation, Software), "Custom" last
  (forms/kind-choices.ts, tested). SelectMenu `typed` mode lets letters / space / Home / End through to the box; every
  dropdown list now keeps inside the visible screen when a phone keyboard is up (visualViewport). DEPLOYED 2/11/2026
  (owner: "just deploy dropdown fix"; alone — the black birds and the period pills stayed in preview).
- 2/11/2026: INCOME CHART YEAR IN THE HEADER (owner: "keep the year on the side like the other charts"): the side chart
  "Income vs expenses" lost its own year dropdown (inside the chart, left of the legend); the year is the same
  PeriodSwitch as Where money went? / compare, top-right of the chart header (Dock yearPick.income), and the chart shows
  the year of the overview's as-of date (IncomeExpenseChart `year` prop; its own dropdown only when nothing outside
  picks the year). Picking an earlier year = the estate at that year's end, like the other charts. DEPLOYED 2/11/2026
  (owner: "deploy year on the side"; alone — black birds + period pills still in preview).
- 2/11/2026: YEAR | ALL TIME PILL (owner: first "add all time and custom date … in every page where dates are present",
  then on the Reports screenshot: "just add all time with year pill. just like the fy and calender pill. remove the < >
  feature on the year") — supersedes 1/11 "years only". Custom dates were built and then dropped (UI only).
  • Data → Payments / Expenses, Reports (home + Income & expenses / Occupancy): forms/PeriodPicker = [ Year | All time ]
    then the year dropdown (Year only) then [ FY | Calendar ] (with Year; with All time too in reports, whose rows group
    by year). The ‹ › year stepper beside the report year is GONE. Phones: the pill full width, then year + FY | Calendar.
  • 3D windows (house, mailbox, property) + side charts (Income vs expenses, Where money went?, compare): ONE period for
    the whole overview (hud/year-jump.ts SpanContext: span year | all + setAsOf). hud/PeriodSwitch = [ Year | All time ]
    + the year dropdown in the window title bar / chart header. Year = as before (as-of = that year's end); All time =
    periods.allTime as of today (income chart = one bar pair per year). Time travel (sun / moon) returns to Year.
  • Kept from the custom-dates build (API only, nothing in the UI sends it): GET /api/dashboard?from=&to= fills the
    dashboard's YEAR SLOT with rangeScope (CashScope.slot "year" keeps explain keys year:… / yoy:year:…), as-of = the
    To day; expenseComposition.span (the year slot's spending ring — now also used for plain years); spanSeries
    (income-chart columns for a range) — tested in reports.test.ts. IncomeExpenseChart still takes a `span`.
  • Chosen pill keeps dark text under the mouse (it went white-on-white: forms.module.css hover rule skips aria-checked).

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
