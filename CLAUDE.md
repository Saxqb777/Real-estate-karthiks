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

## Site plan (from owner's drawing)
Plot: front width 22'3" (22.25 ft), back width 23'3" (23.25 ft), depth 76' (label 76.66 ft), area 1,744 sqft.
Two identical buildings, each ~20 ft wide × 28 ft deep, flush to the right boundary with ~3 ft side passage on the left.
Front building at 0–28 ft, ~10 ft open courtyard gap, back building ~38–66 ft, ~10 ft rear yard.
Each building has a stepped notch at its front-right corner (~6.5 ft wide × ~9.5 ft deep, one small step) and an external
staircase just behind it on the right (~7 ft wide × ~5 ft). These defaults are used when Plot/Unit dimension fields are empty.

## Local dev in the cloud container
The container cannot reach Neon (egress policy). Use the local Postgres: `service postgresql start`,
DB `estates_dev` (user/pass `estates`). `.env` points there. Neon creds are in gitignored `.env.neon`.
Apply schema changes to Neon via the Neon MCP (`run_sql_transaction`) or via `prisma migrate deploy` in the Vercel build.

## Working agreement with the owner
- Keep replies simple, bullet points; explain deeply only when asked.
- Never ship a change without the owner's final confirmation.
- Work in steps; stop after each step for review.
