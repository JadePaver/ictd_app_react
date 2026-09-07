# ICTD App — Admin Dashboard

Web dashboard version of the `ictd_app` Flutter/Supabase app, for
administrators/managers (ICTD staff — the app's existing `operator` role).
Prioritizes **showing data** (live stats, trends, breakdowns), **updating
it** (accept/deny/complete requests, book in/update/release repair items,
publish announcements, manage user roles), and **reporting on it** (a
printable per-technician performance record).

Talks only to `ictd_app_express` for data — it never queries Supabase
directly except to sign in. See that project's README for the API and
how it enforces operator-only access.

## Setup

```bash
npm install
cp .env.example .env.local
```

`.env.example` already has the working `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` (same project + public anon key as the Flutter
app). Leave `VITE_API_BASE_URL=/api` for local dev — `vite.config.ts`
proxies it to `ictd_app_express` on `http://localhost:4000`.

```bash
npm run dev     # http://localhost:5173 — start ictd_app_express first
npm run build   # typecheck + production build to dist/
npm run preview # serve the production build locally
npm test        # node:test over the pure helpers, no test framework needed
npm run lint    # oxlint
```

`npm test` runs Node's own test runner against its own TypeScript stripping,
so there is no framework or transform to install. Tests live beside the code
as `*.test.ts` and are typechecked by `tsconfig.test.json` (they need Node's
types, which the app project deliberately excludes).

## Sign-in

Sign-in is Supabase Auth Google OAuth, using the **same** Google
provider config the Flutter app already has registered in the Supabase
dashboard — no separate OAuth client setup needed. Only accounts with
an `operator` role assignment (`ictd_app`'s existing ICTD-staff role)
get past the API's auth gate; anyone else sees an "Access restricted"
screen and can sign out and try another account.

## Project layout

```
src/
├── context/AuthContext.tsx   # Supabase session + operator-role gate (calls GET /api/auth/me)
├── lib/
│   ├── supabaseClient.ts     # auth-only Supabase client
│   ├── apiClient.ts          # fetch wrapper — attaches the session's bearer token
│   ├── resources.ts          # typed functions for every ictd_app_express endpoint
│   ├── statusStyles.ts       # request/repair status → badge tone mapping
│   └── csv.ts                # CSV quoting + browser download (report export)
├── components/
│   ├── layout/                DashboardLayout (sidebar + outlet)
│   ├── ui/                    Card, Badge, Button, Modal, StatTile, Spinner, EmptyState
│   └── charts/                TrendLineChart, HorizontalBarChart, Sparkline,
│                              StackedBarChart, CompositionBar
└── pages/
    ├── OverviewPage.tsx        KPIs, status/trend/department charts, recent activity
    ├── reports/                 per-technician performance report (print + CSV)
    ├── requests/                filterable list + accept/deny/complete detail modal
    ├── repairs/                 filterable list + book-in + status-update/edit detail modal
    ├── announcements/           list + create/edit/delete
    ├── departments/             list + per-department employee roster
    └── users/                   directory + role management
```

## Technician report

`/reports/technician` is the one screen about a *person* rather than a
queue: pick a technician and a period (monthly, annual, or overall) and get
a document they can print, sign, and take into a performance review, or
export as CSV. It covers service work only, so inventory and custody
bookkeeping is out of scope (the API's `SUMMARY_SOURCES` explains why).

- **The sheet is the document.** `TechnicianReportSheet` holds no controls.
  The page around it owns the pickers and the export buttons, so what's on
  screen below the filter row is exactly what comes out of the printer.
- **Printing is a first-class layout, not an afterthought.** The app shell is
  viewport-locked (`h-screen overflow-hidden` with one scrolling `<main>`),
  which by default prints a single clipped screenful. The `@media print`
  block in `index.css` unlocks it via the `data-app-shell` / `data-app-main`
  attributes, hides `.no-print` chrome, reveals `.print-only` blocks (the
  letterhead and signature lines), repeats table headers across page breaks,
  and forces the light palette so a dark-mode session doesn't print a black
  page. Any future printable page gets the same treatment by reusing those
  hooks.
- **A4 is only about 688px wide**, so Tailwind's `md:` and up never match on
  paper. Anything needing columns in print says so with an explicit `print:`
  variant at the call site. The one global lever lives in the print block:
  dropping the root font-size scales every rem-based size together and fits
  noticeably more per page. A typical report lands on three or four A4
  pages depending on how much the technician did.
- **Icons carry meaning, never colour alone.** Request types get a mark
  matched on the `request_types.label` keyword (`requestTypeIcon`), so
  adding a row to that reference table picks up a sensible icon on its own
  and an unrecognized one still renders something deliberate. Outcomes
  (accepted, completed, denied) always pair their icon with the word.
- **`reportMetrics.ts` is the single source for the numbers.** The metric
  table, the CSV export, and the sheet all read `metricGroups()`, so a
  downloaded file can't disagree with the printout it came from. The
  per-type table carries a total row for the same reason: a reader can check
  it against the headline tiles instead of taking it on faith.
- **No chart animations.** Chrome relays the page out as the print dialog
  opens, which makes Recharts re-animate; print at the wrong moment and the
  bars come out half drawn. Every chart sets `isAnimationActive={false}`.
- **Keep-together is opt-out, not automatic.** Panels avoid splitting across
  printed pages by default (`Panel`'s `keepTogether`), but a block that is
  nearly a page tall wastes more paper than a clean split saves. The metric
  table and the recent-work list are both allowed to flow; their headers
  repeat and their rows stay whole instead.

## Accessibility

Worth knowing before adding to any of these screens:

- **Icons are decorative by default.** Every icon in `ui/icons.tsx` renders
  `aria-hidden` and out of the tab order, because each one sits beside real
  text or inside a control with its own `aria-label`. An icon that ever needs
  to carry meaning alone overrides both (`{...props}` is spread last).
- **Charts are labelled images.** A Recharts SVG has no accessible name, so
  each plot is wrapped in `role="img"` with a spoken summary of what it
  shows. Sparklines and the work-mix bar are the exception: they restate a
  number printed right beside them, so they are hidden outright.
- **Tables carry a caption and scoped headers.** Every table in the report
  has an `sr-only` caption naming it, `scope="col"` on its column headers and
  `scope="row"` on the first cell of each row, so a screen reader announces
  "Hardware, Completed, 11" rather than a bare number.

## Design system

Charts and status color follow the `dataviz` skill's validated palette
(`src/index.css` holds the `--series-*`, `--status-*`, and ink/surface tokens,
exposed as Tailwind utilities via `@theme`). Both light and dark mode are
selected, not an automatic filter flip.

Two rules worth knowing before adding a chart:

- **Color follows the entity, not its position.** An entity wears one hue
  everywhere: requests green, repair items orange, announcements purple.
  Repair items used to be teal; teal against the brand green fails the
  normal-vision separation check (ΔE 13.3, below the floor of 15), which the
  report's stacked chart puts side by side. That check is a hard fail the
  skill says secondary encoding does not excuse, so the hue was re-stepped
  in every place at once rather than worked around in one chart. See the
  `WORK_STREAMS` comment in `pages/reports/reportMetrics.ts`.
- **No negative left margins on a Recharts plot.** They claw back padding by
  sliding the y-axis off the plot area, which silently clips the leading
  digit of any multi-figure tick: "16" renders as "6".
