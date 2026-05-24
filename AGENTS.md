# AGENTS.md

Guidance for AI coding agents working in this repo. Humans: see `README.md` for
the full writeup.

**Made Me Think of You** — a Vite + React app (CSS Modules, no Tailwind) on
Supabase (auth, postgres, realtime, storage), hosted on Netlify.

## Commands

```bash
npm install      # install deps
npm run dev       # dev server on http://localhost:5173
npm run build     # production build
npm run lint      # eslint
```

There is no automated test suite. Verify changes by running `npm run dev` and
exercising the feature, and keep `npm run lint` clean.

## Database migrations

Schema lives as SQL files in `supabase/migrations/`. **Deployment is automatic:**
when a migration file is merged to `main`, the
`.github/workflows/deploy-migrations.yml` GitHub Action runs `supabase db push`
and applies it to the production database.

Rules when changing the database:

- Create migrations with `supabase migration new <short_description>` so they get
  a correct timestamp prefix. Never hand-name migration files — they run in
  filename order and the prefix is what keeps that order correct.
- Write the SQL in the new file under `supabase/migrations/`. Match the style of
  the existing files: enable RLS on new tables, add policies scoped to the user's
  partnership (see `public.current_partnership_id()`), and use `security definer`
  for helper functions where the existing code does.
- **Do NOT run `supabase db push`, `supabase migration repair`, or otherwise
  connect to the production database.** You don't have credentials and don't need
  them — merging to `main` deploys the migration. Stop after writing the file.
- **Never edit a migration that has already been applied.** To change something,
  add a new migration.
- After a migration merges, the deploy shows up under the repo's **Actions** tab.
  If it fails, the migration did NOT apply — fix the SQL in a new commit.

## Code conventions

- **No Tailwind.** Each component has its own `.module.css`. The design system
  (colors, fonts, shadows) is in `src/styles/tokens.css` — use the CSS variables.
- Cormorant Garamond is reserved for card backs; UI uses DM Sans, display uses
  Playfair Display.
- Mementos store position as normalized 0–1 floats (`pos_x`, `pos_y`) rendered
  onto a 3200×2600 virtual canvas.
- See `README.md` → "Architecture" and "Notes for contributors" for the rest.
