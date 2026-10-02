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
  black **water tank** found on Tamil Nadu roofs, external staircase, stepped front-right notch (see CLAUDE.md site plan).
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

## Tokens (CSS variables in globals.css — use these, never hard-code colours)
```
--bg-0 #070B16   --bg-1 #0D1426   --bg-2 #121B33
--panel rgba(18,26,48,0.62)   --panel-strong rgba(22,32,58,0.88)
--line rgba(148,170,255,0.14) --line-strong rgba(148,170,255,0.30)
--text #EAF0FF   --text-dim #9AA7C7   --text-faint #5E6B8C
--marigold #FFB547 (brand / primary)   --saffron #FF8A3D
--teal #2DD4BF (income, positive, occupied)   --coral #FF5D73 (expense, negative, overdue)
--sky #60A5FA (info)   --violet #A78BFA   --laterite #B5532E   --palm #3FA66B   --plaster #F3E9D8
--radius 14px  --radius-sm 10px
```
Brand gradient: marigold → saffron. Glow: `0 0 0 1px var(--line-strong), 0 8px 30px rgba(0,0,0,.45)`.

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
- A **street along the plot front** (asphalt with worn edges, mud shoulder, a drain, an electric pole with sagging wires, a street lamp).
- **Traffic loop**: auto-rickshaws (yellow/green TN autos), a TVS moped / scooter, a cyclist, an occasional small car or bus — low-poly,
  stylised, driving both directions with headlights at night.
- **Pedestrians**: a few stylised low-poly people walking the street (simple walk bob + limb swing), someone with an umbrella, a kid running,
  a vendor pushing a cart; occasionally someone stops at the gate.
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
- Login page greets with the Tamil greeting for the phase (e.g. "காலை வணக்கம்" / "மாலை வணக்கம்" / "இரவு வணக்கம்").
- Transitions between phases are smooth (lighting lerps over ~minutes of real time; a manual override lets the owner preview any phase).
