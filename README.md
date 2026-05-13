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
2. Run the schema migration: open the project's SQL Editor → New query → paste
   the contents of `supabase/migrations/0001_init.sql` → Run.
   This creates the tables, RLS policies, storage buckets, and the realtime
   subscription. Safe to run once on a fresh project.
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
