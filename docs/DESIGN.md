# Design brief — "Pattukottai at Dusk: a living diorama"

The owner's words: "visually eye-pleasing is the whole reason I am making this", "game-y look", "interactive as f***",
"a 3D model around the site plan where all the fields match where they stay", "make it insane".

## Concept
A premium **city-builder / management-game HUD** wrapped around a real-estate ledger.
The 3D plot is the *world*; the numbers are the *HUD*. Every number feels alive (count-up, glow, hover detail),
every entity (unit, tenant, payment) is clickable, and the 3D model is driven by real data
(plot widths/depth, unit footprint, position front/back, floors, occupancy, rent status).

## The world (3D diorama)
- The plot sits on a floating **laterite soil tile** (red earth, cut edge shows soil strata, like a game board tile),
  trapezoid shaped exactly per plot fields (front width, back width, depth).
- Two cream-plaster **townhouses** with terracotta parapet + a Chettinad-style accent band, flat roofs with the classic
  black **water tank** found on Tamil Nadu roofs, external staircase, external dog-leg stair in the yard in front of each house, rear-right backyard notch, compound wall as a separate enclosure with two gates (see CLAUDE.md site plan — the owner's annotated plan).
- **Coconut palms** around the plot (Pattukottai is coconut country), compound wall with gate, a white **kolam** at each entrance,
  soft clouds, gentle ambient motion (palm sway, drifting clouds, fireflies at night).
- **Day / dusk / night** lighting follows the real IST clock (toggle available). Windows glow warm at night when occupied.
- Status language on each unit (consistent everywhere in UI too):
  - occupied + paid → **teal** ground ring
  - payment due within 5 days → **marigold** ring
  - overdue → **coral** pulsing ring + floating "!" quest marker above the roof
  - vacant → holographic **blueprint/ghost** look + "TO-LET" signboard
  - inactive → desaturated
  - not yet created → wireframe "empty slot" with a "+ Build unit" affordance
- Hover = outline glow + floating label (unit name, tenant, rent). Click = camera glides to the unit, unit card slides in.
- Optional dimension lines (like the drawing: 22'3", 76', 20', 28') — used in Config preview so fields visibly map to the model.

## HUD styling
- Dark UI. Glass panels (backdrop blur) with a 1px hairline border + faint top inner highlight, and small **corner brackets**
  (like game UI frames). Subtle noise/grain and a faint grid on the page background.
- Numbers: tabular figures, count-up animation on change, INR in Indian grouping (₹12,34,567) or compact (₹45.2 L / ₹1.25 Cr).
- Progress bars are **segmented** (tick marks) like XP bars. Occupancy = XP bar. Capital multiplier shown as a "level" badge.
- Onboarding (DB starts empty) = **Quest log**: "Set your plot dimensions", "Build unit 1", "Build unit 2", "Add a tenant",
  "Sign a lease", "Record first rent" — each with progress and a button that takes you there.
- Quick actions everywhere + a **command palette (Ctrl/⌘ K)**: Record payment, Add expense, Add action, Go to Config…
- Toasts celebrate events (e.g. "+₹25,000 rent collected" with a coin burst).
- Respect `prefers-reduced-motion`.

## Tokens (CSS variables in src/app/globals.css — the source of truth; use these, never hard-code colours)
Warm-dark neutrals (not navy — see HARD RULE):
```
--bg-0 #0e0d0b  --bg-1 #151310  --bg-2 #1c1915  --bg-3 #25211c
--panel #181512  --panel-strong #201c18  --panel-glass rgba(22,19,16,.74) (only over the 3D scene)
--line rgba(243,233,216,.09)  --line-strong rgba(243,233,216,.18)  --line-bright rgba(243,233,216,.32)
--text #f2eadd  --text-dim #a89e8f  --text-faint #6f675c
--marigold #ffb547 (brand / primary)  --saffron #ff8a3d
--teal #2dd4bf (income, positive, occupied)  --coral #ff5d73 (expense, negative, overdue)
--sky #60a5fa (info, occupancy, vacant blueprint)  --violet #a78bfa (chart series only)
--laterite #b5532e  --terracotta #c8693f  --palm #3fa66b  --plaster #f3e9d8
--radius 10px  --radius-sm 6px  --radius-xs 4px
```

## Type
- Display / numbers / labels: **Rajdhani** (600/700; Indian Type Foundry) — uppercase, letter-spaced for labels.
- Body / forms: **Manrope**.
- Tamil accent: **Noto Sans Tamil** for "பட்டுக்கோட்டை" under the brand.
Load via `next/font/google` in `src/app/layout.tsx` as CSS variables `--font-display`, `--font-body`, `--font-tamil`.

## Layout
- Top HUD bar: brand mark + name + Tamil town, nav (Overview · Data · Config), live IST clock with day-phase icon, ⌘K button, logout.
- Mobile: bottom tab bar, panels stack, 3D hero shorter. No horizontal page scroll at 375px.
- Pages: `/` Overview (3D hero + HUD + analytics), `/data` (tenants, leases, payments, expenses, property tax, actions),
  `/config` (settings, plot, units, offers, categories), `/invoice/[id]` (printable, light), `/login`.

## HARD RULE: must not look AI-generated (owner request)
The owner explicitly does not want the generic "AI-made" look. Avoid:
- Purple/blue neon gradients, gradient text, glowing blobs/orbs in the background, everything-glows.
- Glassmorphism on every surface — use solid, slightly textured panels; reserve blur for overlays on the 3D scene only.
- Sparkle ✨ / rocket / emoji icons, "AI magic" iconography, generic stock illustrations.
- Marketing copy ("Unlock your portfolio's potential", "Welcome back! 👋"). Write plain, specific owner language:
  "Rent due 5 Oct — Unit A", "₹18,000 collected this month", "Back unit vacant 42 days".
- Uniform grids of identical rounded cards with an icon in a circle + big number + tiny label. Vary hierarchy:
  one dominant number per section, supporting figures smaller, tables where tables are clearer.
- Huge border radii, pill-everything, drop shadows on everything, centered-everything layouts.
- Default Inter/Poppins look, random accent colours, rainbow charts.
Do instead — crafted and specific to this place:
- Materials from the actual site: laterite red earth, terracotta, lime-washed plaster, coconut-palm green, marigold, Chettinad tile accents.
- Crisp 1px hairlines, tight consistent spacing, small radii (6–10px), real typographic hierarchy (Rajdhani numerals, uppercase tracked labels).
- Game feel through *specific details* (corner brackets, segmented XP bars, quest log, status markers in the 3D world, ticker-style numbers),
  not through glow. Glow only for status signals (overdue pulse, selected unit).
- Restrained palette: mostly warm-dark neutrals, one brand accent (marigold), teal/coral only for meaning (income/expense, ok/overdue).
- Purposeful asymmetry and density like a real management game screen, not a SaaS landing page.

## Living world (owner request: "lively vibe, people walking, cars going, wind — make it crazy")
The diorama must feel alive, like a tiny Tamil Nadu street scene running in real time:
- **No road (owner, 3/10/2026, after sending photos of the houses)**: the asphalt street, shoulders, drain, kerbs and all traffic were
  removed; open natural grass surrounds the plot on the floating island. The electric pole (sagging wires, lamp, meter) stands on the
  grass by the gate. The houses follow the photos: single storey + roof terrace, cream walls with black accents, grilled veranda,
  dog-leg external stair with black rails in the yard, cream compound wall (separate enclosure) with the black line pattern on all sides, jaali panels and two black diamond gates; front parapet design centred on each façade (photo 10); water tank over the back exit.
- **Pedestrians**: a few stylised low-poly people walking across the grass and round the palms / banana garden (simple walk bob + limb
  swing), someone with an umbrella, a kid running; occasionally someone stops at the gate. A zebu cow grazes under the palms.
- **Wind**: palm fronds sway with gusts (shader/vertex sway, gust strength varies over time), leaves/petals drifting across the plot,
  clothes drying on a rooftop line fluttering, a small flag/bunting on the gate, ripples in a puddle.
- **Sky life**: birds (crows / parakeets) flying in loose flocks across occasionally, clouds drifting, sun/moon arc by IST time,
  stars + fireflies at night; street lamp and house windows switch on at dusk.
- Small details: a stray dog napping / trotting, a cow by the roadside, a kolam that is freshly drawn in the morning.
- Everything procedural + instanced, frame-rate independent, paused off-screen, disabled/reduced with prefers-reduced-motion, and
  a "Life" toggle (on by default) in the scene HUD. Must keep 60fps on a normal laptop and stay smooth on a phone (scale down counts on mobile).

## Time of day in Tamil (owner request)
One shared helper (src/lib/day-phase.ts) maps IST time → phase, used by BOTH the HUD clock and the 3D lighting so they always agree:
| IST        | Tamil      | English    | Scene                                   |
|------------|------------|------------|-----------------------------------------|
| 04:00–06:00| அதிகாலை    | Dawn       | blue hour → pink horizon, birds start   |
| 06:00–12:00| காலை       | Morning    | warm low sun, long shadows, fresh kolam |
| 12:00–16:00| மதியம்     | Afternoon  | high bright sun, short shadows, heat    |
| 16:00–19:00| மாலை       | Evening    | golden hour → dusk, lamps switch on     |
| 19:00–04:00| இரவு       | Night      | moon, stars, fireflies, lit windows     |
- HUD clock shows the Tamil word large (Noto Sans Tamil) + English small + time, e.g. "காலை · Morning · 7:42 AM", with a small sun/moon arc.
- **Two clocks (owner lives in the UAE):** the property clock (Pattukottai, IST — drives the Tamil phase + 3D lighting) and, quieter beside it,
  the owner's own time ("1:01 AM · YOUR TIME [UAE]", `HOME_ZONE` + `clockAt()` in src/lib/day-phase.ts). Mobile: compact "UAE 1:01 AM" under
  the India time. The login screen shows both too (e.g. "Pattukottai 7:42 AM · UAE 6:12 AM").
- Login page greets with the Tamil greeting for the phase (e.g. "காலை வணக்கம்" / "மாலை வணக்கம்" / "இரவு வணக்கம்").
- Transitions between phases are smooth (lighting lerps over ~minutes of real time; a manual override lets the owner preview any phase).

## ONE-SCREEN RULE (owner request — overrides any long-scroll layout above)
No long scrolling pages. Every page fits the viewport (100dvh) like a game screen; the body never scrolls on desktop.
Content that doesn't fit lives in tabs / drawers / panels that scroll *internally*.

### Overview ("/") = the game screen
```
┌ top bar: brand · Tamil town · nav · Tamil clock · ⌘K ───────────────────────┐
│┌LEFT HUD (≈320px)┐        3D WORLD fills the whole screen        ┌RIGHT HUD┐│
││ PORTFOLIO        │        (background layer, interactive)        │ THIS     ││
││ ₹1.12 Cr (hero)  │                                               │ MONTH    ││
││ invested · LVL   │                                               │ rent XP  ││
││ CAGR             │                                               │ next due ││
││ NET PROFIT       │                                               │ to-dos   ││
││ rent ▮▮▮ exp ▮   │                                               │ (unit    ││
││ alerts ticker    │                                               │  card on ││
│└──────────────────┘                                               │  click)  ││
│┌ BOTTOM DOCK (tabbed tray, collapsible, keys 1–6) ───────────────────────────┐│
││ [Income vs exp] [Expenses] [Front vs Back] [Occupancy] [Growth] [Payments]  ││
││  one chart/table visible at a time, ≈240px tall                             ││
│└─────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘
```
- Empty DB → the left HUD shows the Quest log instead of money panels.
- Clicking a unit swaps the right HUD to the unit card; Esc / click ground returns.
- Dock can collapse to a slim bar for a full-world view ("F" toggles). Panels never cover the units' centre.
- Laptop 1280×720 must still fit without page scroll (panels compress, dock shorter).

### Data ("/data") and Config ("/config")
- Fit the viewport: tab rail + one panel; tables/forms scroll inside their panel with sticky headers.
- Config: form on the left, live 3D preview on the right, both within the screen.

### Mobile (<768px)
- 3D world on top (~45dvh) + a bottom sheet with swipeable tabs (Portfolio · This month · Charts · Units · To-do).
  Still no long page scroll — swipe/tabs, content scrolls inside the sheet.

## Interaction model (owner-approved) — "inspect like a game"
Owner chose: world objects open data, every number drills down, radial action menu, time scrubber, and both quick-edit pop-ups + Data/Config pages.
Pop-up style (owner: "think of it like a game") → RPG "inspect" pattern, three depths, never leaving the screen:
1. **Hover = tooltip** (like an item tooltip): name + 1–2 key figures + state colour. Instant, follows the object.
2. **Click = inspect card** anchored to the object with a leader line (corner-bracket frame, slides/scales in from the object).
   Shows the essentials + 2–3 primary actions. Only one open at a time.
3. **Expand (⤢ or Enter) = side panel** sliding in from the right: full details, history table, inline editing. Esc steps back one depth.
- Opening an inspect card on a unit nudges the camera so the card never covers the object.

### World objects = data entry points (diegetic UI)
| 3D object                     | Opens                                         |
|-------------------------------|-----------------------------------------------|
| House                         | Unit card (value, offer, gain, tenant, rent)  |
| Mailbox at the gate           | Payments & invoices (record rent here)        |
| Notice board by the gate      | To-dos / action items                         |
| Electric pole + meter         | TNPDCL consumer no. + Pay electricity link    |
| TO-LET board (vacant unit)    | New lease wizard                              |
| Tenant figure at the door     | Tenant profile, tap-to-call                   |
| Plot boundary / ground marker | Plot dimensions (opens Config → Plot)          |
| Tax collector + moped (right of the plot) | Property tax per year (mark paid) + collector's call / WhatsApp |
Objects show a subtle interact hint on hover (outline + cursor + tooltip) so they're discoverable; a "?" help overlay lists them.

### Every number drills down
Any KPI/total is clickable → breakdown card (e.g. Net profit → rent by unit + expenses by category) → click a row → the underlying
records (payments / expenses) with inline edit. Breadcrumb inside the panel ("Net profit › Expenses › Maintenance").

### Radial action menu — REMOVED (owner, 9/10/2026)
Was: right-click (desktop) / long-press (touch) on a house → 6-slot wheel (Record rent · Add expense · Call tenant · Pay
electricity · Add to-do · Move out). Owner: "LETS REMOVE THIS FEATURE". A house click opens its window; its actions live there.

### Time scrubber
A slim timeline in the bottom dock (purchase date → today). Dragging it sets an "as of" date:
the 3D world shows who lived where on that date (vacant/occupied, tenant names), and every HUD number recomputes "as of" that date
(calculations module must accept an asOf date — buildDashboard(input, asOf)). A "LIVE" button snaps back to today. Year tick marks, lease
change markers, play ▶ to animate through time.

## "Show the maths" — every number explains itself (owner request)
The owner wants to understand how every figure is worked out. Every KPI / total / chart value has an **ⓘ How is this calculated?** view
(part of the drill-down inspect card) with 4 layers, in plain English first:
1. **In words** — "What your two units are worth today if you sold at the best offers you've received."
2. **The formula** — `Best offer total ÷ Money invested`
3. **With your numbers** — `₹1,12,00,000 ÷ ₹78,00,000 = ×1.44` (real values substituted, Indian format, each value clickable to its source)
4. **What went into it** — the actual records (offers, payments, expenses, leases) as a small table, plus any assumptions in a marigold note:
   "Back unit has no offer yet — we used its estimated value (₹52.3 L at 8%/yr) instead."
- Step-by-step for multi-step figures (e.g. CAGR: years held → growth ratio → yearly rate; vacancy loss: each gap × rent ÷ 30).
- Numbers animate in step order like a game's damage/score breakdown (respect reduced motion).
- The explanations come from the calculations module (single source of truth): buildDashboard returns an `explain` map keyed by KPI
  with {title, plain, formula, steps:[{label, expression, value}], inputs:[{kind, id, label, value}], notes:[]}, so the maths shown
  is exactly the maths used.

## DATA CLARITY CONTRACT (owner: the old site's reports had discrepancies and confusing formats — never again)
The spec describes the old site's data; presentation must be rethought so nothing is confusing or contradictory.
1. **Three kinds of numbers, never mixed, always visually tagged:**
   - **Cash** (real money that moved: rent, expenses, net cash, deposits) — solid figures, ₹ icon chip, teal/coral.
   - **Paper value** (estimates & offers: worth now, best offer, gain, multiplier, CAGR) — marked "est." / "offer" tag, value shown
     with a dotted underline; estimates never look like cash.
   - **Occupancy** (days, vacancy, rent lost) — calendar chip; "rent lost" is an opportunity cost, never subtracted from cash.
   The HUD groups figures into these three buckets with consistent headers: CASH FLOW · PROPERTY VALUE · OCCUPANCY.
2. **Every number states its scope and date**: a small scope chip — ALL TIME / 2026 / OCT 2026 / AS OF 2/10/2026. No unlabeled totals.
   One global period control (All time · Year · Month) drives the HUD; the time scrubber sets "as of".
3. **One definition per metric, one source**: all figures come from src/lib/calculations.ts; a metric shown in two places is the same
   value (same function, same scope). A glossary (ⓘ) defines every term in plain English. Fixed vocabulary — never synonyms:
   "Invested", "Worth now (est.)", "Best offer", "Gain", "Rent collected", "Expenses", "Net cash", "Deposits held", "Rent lost (vacant)".
4. **Deposits are not income**: security deposits are shown as money held on behalf of tenants (a liability), separate from rent;
   refunds shown against them.
5. **Reconciliation is visible**: totals show their arithmetic inline (Net cash = Rent collected − Expenses), table footers show totals that
   match the HUD, and a small "Ledger balanced ✓" check (computed: Σ unit rows + whole-plot rows = totals) appears on reports. If anything
   doesn't reconcile, show a coral warning — never silently.
6. **Formats, everywhere identical**: ₹ with Indian grouping (₹12,34,567). Compact (₹45.2 L / ₹1.25 Cr) only for big HUD figures, with the
   exact value on hover/tap. Whole rupees unless paise exist. Dates D/M/YYYY; months "Oct 2026"; percentages 1 decimal; multiplier "×1.44".
   Negative = minus sign + coral. Zero shown as ₹0, missing data shown as "—" with a reason on hover ("no offer yet").
7. **Colour = meaning, consistently**: income teal, expense coral, paper value marigold, occupancy sky; each expense category keeps its own
   colour in every chart, table chip and legend. Charts start at zero, label values directly, show empty months as zero, tooltips with exact ₹.
8. **Reports** (Data → Reports, printable, light theme for print/PDF): Annual statement per year (cash flow by month and by unit, expense by
   category, deposits ledger, occupancy), Unit report (purchase → today story), Rent ledger per lease (expected vs received per month,
   arrears). Every report shows "Generated D/M/YYYY", scope, and reconciles with the dashboard.

## Year type (owner choice: both, with a toggle)
- Default **Indian Financial Year** (1 Apr – 31 Mar), labelled "FY 2025-26"; toggle to **Calendar year** ("2026").
- The toggle lives in the global period control and is remembered per browser. Every scope chip uses the active label.
- The calculations module groups by a `yearMode: "fy" | "calendar"` parameter (buildDashboard(input, asOf, { yearMode })) and
  /api/dashboard accepts `?yearMode=fy|calendar` (default fy) — the UI never regroups numbers itself.

## NO-CLUTTER RULES (owner: "nothing should feel jumbled")
- **Show little, reveal more**: the main screen shows only the essentials; everything else is one tap away (inspect card → side panel).
- **Per HUD panel: 1 hero number + max 3 supporting figures.** Anything more goes into the drill-down.
- **Max 3 HUD panels visible at once** over the world (left, right, bottom dock); the dock shows one tab at a time.
- **One accent per panel** (its bucket colour); everything else neutral. No more than one animated/pulsing element in view
  unless it's an alert.
- **Alerts are prioritised and capped**: ticker shows the top 3 (overdue > due soon > tasks); "+N more" for the rest.
- Generous, consistent spacing (8px grid), aligned edges, numbers right-aligned in tables, labels never wrap awkwardly.
- Empty / zero states are calm ("No expenses yet this FY") — never a wall of ₹0 tiles.
- Every screen must pass the **3-second test**: a first-time look answers "is everything OK?" (all-green state vs what needs attention).
- Round-2 review includes a dedicated clutter critic that screenshots each screen and removes anything that isn't earning its place.

## Discoverability & hints (owner: "everything opens with an interactive click, with hints showing")
- Everything clickable looks clickable: hover → pointer cursor + hairline glow + lift; a short hint label appears after ~300ms
  ("Click for breakdown", "Click to record rent"). Touch: a tap opens. (Right-click / long-press radial menu removed 9/10/2026.)
- **First-run tutorial** like a game: a 5–6 step coach-mark tour (spotlight + short text + Next/Skip) the first time the owner logs in —
  the world, a house, the mailbox, a HUD number (show-the-maths), the dock, ⌘K. Re-playable from the "?" menu. Remembered per browser.
- **Unexplored hints**: a tiny marigold dot on interactive things never opened yet (houses, mailbox, notice board, pole, each dock tab);
  it disappears once used. Never more than 3 dots visible at once.
- **"?" key / button** toggles a help overlay that labels every hotspot in the 3D world and HUD with what it opens + keyboard shortcuts.
- Every inspect card and panel shows its next step as a hint at the bottom ("Enter to expand · Esc to close · ⓘ how is this calculated").

## Layout decision (owner delegated: "do what's best, change later if needed")
Chosen: **A — world as background**, refined to stay calm:
- The 3D world fills the screen; the camera frames the plot inside the *free area* between the HUD panels (computed from panel
  sizes, so houses are never covered), plot ≈ 40–50% of viewport width, street + palms visible around it.
- HUD panels are near-solid (panel-strong, light blur only) so text is always crisp over the moving world.
- **Focus dimming**: when a side panel or the dock is expanded for reading, the world softly dims/desaturates and ambient motion slows;
  it returns when closed. "F" hides all HUD for a full-world view.
- Easy to switch later to B (framed world) — keep the layout in one component with a `layout="immersive" | "framed"` prop.

## Clean world by default — panels open on click (owner idea, adopted; supersedes "panels always visible")
- **Default view = the world**, nearly clean: slim top bar + a small **status strip** of up to 3 chips (e.g. "All rent paid ✓",
  "Back unit 3 days late", "Tax due Nov") so the 3-second test still passes. The houses themselves show status (rings / "!" markers).
- **Click a house** → its unit panel slides in (right). **Click a chip** → the matching panel. **Click the mailbox / notice board / pole**
  → their panels. **Click the "Property" chip or press P** → the overall property panel (left: value, cash flow, occupancy).
- **Bottom tray is collapsed** to a slim tab bar; clicking a tab slides the chart up; click again or Esc to close.
- Panels close with Esc / click empty ground / ✕; the world un-dims. A **📌 pin** on any panel keeps it open for owners who like
  numbers always visible (remembered per browser).
- First-run tutorial explicitly teaches "click a house to see its details".
