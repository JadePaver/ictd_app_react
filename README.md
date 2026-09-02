# ICTD App — Admin Dashboard

Web dashboard version of the `ictd_app` Flutter/Supabase app, for
administrators/managers (ICTD staff — the app's existing `operator` role).
Prioritizes **showing data** (live stats, trends, breakdowns) and
**updating it** (accept/deny/complete requests, book in/update/release
repair items, publish announcements, manage user roles).

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
```

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
│   └── statusStyles.ts       # request/repair status → badge tone mapping
├── components/
│   ├── layout/                DashboardLayout (sidebar + outlet)
│   ├── ui/                    Card, Badge, Button, Modal, StatTile, Spinner, EmptyState
│   └── charts/                TrendLineChart, HorizontalBarChart, Sparkline
└── pages/
    ├── OverviewPage.tsx        KPIs, status/trend/department charts, recent activity
    ├── requests/                filterable list + accept/deny/complete detail modal
    ├── repairs/                 filterable list + book-in + status-update/edit detail modal
    ├── announcements/           list + create/edit/delete
    ├── departments/             list + per-department employee roster
    └── users/                   directory + role management
```

## Design system

Charts and status color follow the `dataviz` skill's validated palette
(`src/index.css` — the `--series-*`, `--status-*`, and ink/surface tokens,
exposed as Tailwind utilities via `@theme`). Both light and dark mode are
selected, not an automatic filter flip.
