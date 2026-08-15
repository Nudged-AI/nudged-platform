# Nudged

Coaching extends into daily life. Nudged gives coaches a workspace to run their practice — capsules, sessions, coachee rosters — and gives coachees a daily surface for goals, reflection, and focus, backed by AI agents that reason over each coachee's own vision and history.

Three client surfaces share one Supabase backend:

| Surface | Stack | Purpose |
|---|---|---|
| **Web app** | React 18, TypeScript, Vite, React Router, Tailwind | Coach dashboard, coachee workspace, admin |
| **Browser extension** (Return On) | Manifest background worker + content script + popup | Focus-session enforcement, distraction detection |
| **Desktop app** (`electron-app/`) | Electron (main + renderer + overlay) | Return On focus overlay, cross-device sync |

All AI calls (Claude) and third-party integrations route through Supabase Edge Functions — no API key ever reaches a client.

See **[Platform PRD](docs/product/nudged-platform-prd.md)** and **[System Architecture](docs/architecture/nudged-architecture.md)** for the full product and architecture picture, including data flow diagrams, key entities, and known risks.

## Repo layout

```
src/                  Web app (React + Vite)
electron-app/         Desktop app (Electron)
supabase/
  migrations/         Postgres schema + RLS policies
  functions/          Edge functions (claude-llm, generate-good-news, ...)
docs/
  product/            PRD
  architecture/        System architecture
```

## Getting started

### Web app

```bash
npm install
cp .env.example .env   # fill in Supabase project URL + anon key
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build web app + extension background/content scripts |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

### Desktop app

```bash
cd electron-app
npm install
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite renderer + Electron, hot-reloading |
| `npm run build` | Compile main + build renderer/overlay |
| `npm run dist:mac` / `npm run dist:win` | Package installers via electron-builder |

### Environment variables

The web app and desktop app both read Supabase credentials from `.env`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Backend

Schema, RLS policies, and edge functions live in `supabase/`. Apply migrations and deploy functions with the [Supabase CLI](https://supabase.com/docs/guides/cli).
