# Made Me Think of You

A small web app for two people across distance — a shared memory board and a
quick-feed of everyday "made me think of you" moments.

Built by **Lauren & Utku**.

---

## Stack

- **Vite + React** (front end)
- **CSS Modules** (one styles file per component)
- **Supabase** (auth, postgres, realtime, storage)
- **Netlify** (hosting, deploys on push to `main`)

---

## Run it locally

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see below)
npm run dev
```

The dev server runs on http://localhost:5173.

### Supabase setup (first time only)

The app needs a Supabase project. Follow these steps:

1. Go to https://supabase.com and create a project (free tier is fine).
   - If you're at the 2-project limit on your default org, create a new
     **organization** first (free orgs each have their own 2-project quota).
2. Apply the schema. From the repo root, with the [Supabase
   CLI](#database-migrations) installed:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   This runs every file in `supabase/migrations/` — tables, RLS policies,
   storage buckets, and the realtime subscription. (You can also paste
   `supabase/migrations/0001_init.sql` into the dashboard SQL Editor, but the
   CLI is the path everything else uses.)
3. Copy your project's **URL** and **anon public key** (Project Settings → API)
   into `.env.local`:

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

---

## Deploy

Deploys are handled by Netlify, connected to this repo. Pushes to `main`
trigger a production deploy automatically. Build settings live in
`netlify.toml`.

The same two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) need to
be set in **Netlify → Site settings → Environment variables**.

---

## Database migrations

Schema changes live as SQL files in `supabase/migrations/`. When a migration
file lands on `main`, GitHub Actions applies it to the production database
automatically (`.github/workflows/deploy-migrations.yml`, which runs
`supabase db push`). **Nobody has to log into the Supabase dashboard to ship a
schema change — you just merge the file.**

You'll need the Supabase CLI for the commands below: `brew install
supabase/tap/supabase`, or run it ad-hoc with `npx supabase@2.101.0 …`.

### Making a database change

1. Create the migration file:

   ```bash
   supabase migration new short_description
   ```

   This writes `supabase/migrations/<timestamp>_short_description.sql`. Always
   use this command — migrations run in filename order, and the timestamp
   prefix is what keeps that order correct.
2. Write your SQL in the new file.
3. Commit it, open a PR, and merge to `main`. CI runs `supabase db push` and the
   change goes live. Watch it under the repo's **Actions** tab; if `db push`
   fails, the migration was *not* applied — fix the SQL and push again.

No dashboard login, no manual SQL Editor step, no waiting on anyone else.

### One-time setup (already configured — here for reference)

**1. GitHub Actions secrets** (repo → Settings → Secrets and variables →
Actions → New repository secret):

| Secret | Where to find it |
| --- | --- |
| `SUPABASE_PROJECT_ID` | The project ref — the `xxxx` in `https://xxxx.supabase.co` |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database (reset it there if unknown) |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |

**2. Baseline the existing migrations.** Migrations `0001`–`0009` were applied
by hand before CI existed, so the remote history table doesn't know about them.
They must be marked as already-applied once — otherwise the first `db push`
would try to re-run them and fail.

The repo ships a one-time workflow for this. After the secrets above are set:

1. Make sure both workflows are on `main` (merge this branch). The deploy
   workflow only fires on changes under `supabase/migrations/`, so merging it
   does **not** trigger a push.
2. Repo → **Actions** tab → **Baseline existing migrations (one-time)** → **Run
   workflow**. It marks `0001`–`0009` as applied and prints the migration list
   for confirmation. (It only writes to the history table — it does not re-run
   any SQL.)
3. Once it's green, delete `.github/workflows/baseline-migrations.yml`.

> Prefer the CLI? The equivalent local commands are
> `supabase link --project-ref <ref>` then
> `supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009`.

From then on, only brand-new migration files get pushed.

---

## Architecture

```
src/
  main.jsx              Entry, Router setup
  App.jsx               Auth gate + top-level routing

  lib/
    supabase.js         Supabase client
    mementos.js         Memento CRUD + placement algorithm
    image.js            Browser-side photo compression
    format.js           Date / string helpers

  hooks/
    useAuth.js          Session state
    useProfile.js       Current user's profile row
    usePartnership.js   Partnership + both partner profiles
    useMementos.js      Mementos list + realtime subscription

  pages/
    SignIn.jsx          Email + password
    Onboarding/         3-step flow (identity, label, invite)
    InviteAccept.jsx    /invite/:token route — completes identity then joins
    App/
      index.jsx         App shell (nav, add modal, waiting-for-partner state)
      Board.jsx         Pan/zoom canvas of mementos
      Sparks.jsx        (placeholder — coming after board polish)

  components/
    NavBar.jsx          Dark "chain" bottom nav with + button
    MementoCard.jsx     The flippable card (front + back)
    AddMementoForm.jsx  Bottom sheet — pick type, fill, pin

  styles/
    tokens.css          All CSS variables (colors, fonts, shadows)
    global.css          Reset, base body, grain overlay, font import
```

### Data model

Four tables, all in the `public` schema:

- `profiles` — one per signed-in user (extends `auth.users`)
- `partnerships` — links two profiles, has an `invite_token`
- `mementos` — items on The Board (photo / note / emoji)
- `sparks` — items in the Sparks feed (not yet built)

Row-level security limits read/write to your own partnership. The
`join_partnership_by_token(token)` RPC is the only way to join a partnership
as the second member.

---

## Notes for contributors

- **No Tailwind.** Each component has its own `.module.css`. The design system
  is in `src/styles/tokens.css` — use the CSS variables.
- **Cormorant Garamond is reserved for card backs.** Everywhere else uses DM
  Sans (UI) or Playfair Display (display).
- **The chain (`#0F0C08`) only shows up in the nav bar and the + button.**
- **Card backs are always `--card-back` cream.** Even if dark mode ever
  arrives, the flip should always reveal warmth.
- **Mementos store position as normalized 0–1 floats** (`pos_x`, `pos_y`).
  The Board renders them onto a 3200×2600 virtual canvas.
