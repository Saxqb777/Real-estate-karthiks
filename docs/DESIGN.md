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
