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
  (property time); quote ETAs/times to the owner in UAE time. Offered an optional secondary UAE clock — pending his answer.
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
