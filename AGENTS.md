# AGENTS.md

Guidance for AI coding agents working in this repo. Humans: see `README.md` for
the full writeup, and `EXPERIMENT_NOTES.md` for the decision log behind the
Sparks Sky + Stickers features.

**Made Me Think of You** — a Vite + React 19 app (CSS Modules, no Tailwind) on
Supabase (auth, postgres, realtime, storage), hosted on Cloudflare Workers.
A private keepsake app for exactly two people — warm, tactile, handmade. Not a
social app, not a dashboard.

## Commands

```bash
npm install       # install deps
npm run dev       # dev server on http://localhost:5173
npm run build     # production build
npm run lint      # eslint
npm run deploy    # vite build && wrangler deploy (needs Cloudflare access, see Deploys)
```

There is no automated test suite. Verify changes by running `npm run dev` and
exercising the feature. `npm run lint` has **7 pre-existing errors** (the
`setState`-in-effect pattern in older hooks/pages) — leave them, and don't add
new ones: lint your changed files individually.

## Deploys

- **App**: pushing to `main` auto-deploys via Cloudflare's dashboard-side
  Workers Builds integration (there is NO app-deploy workflow in this repo —
  don't go looking for one). Production:
  https://thinking-of-you.khoo-lauren.workers.dev/ on Lauren's Cloudflare
  account. Builds take a few minutes and occasionally fail silently; an empty
  commit re-triggers. A deploy can be verified by fetching the prod JS bundle
  and grepping for a string unique to the new commit.
- **Database**: migration files merged to `main` are auto-applied by
  `.github/workflows/deploy-migrations.yml` (`supabase db push`).

## Database migrations

- Create with `supabase migration new <short_description>` (or
  `npx supabase@2.101.0 …`) so the timestamp prefix keeps file order correct.
  Never hand-name migration files, and never edit an already-applied one — add
  a new migration instead.
- Match existing style: enable RLS, scope policies to the partnership via
  `public.current_partnership_id()`, `security definer` helpers where existing
  code does. Child tables of `mementos` follow the `memento_list_items` /
  `stickers` pattern: partnership-scoped read/insert via a parent join,
  `on delete cascade`.
- **Do NOT run `supabase db push`, `supabase migration repair`, or otherwise
  connect to the production database.** Merging to `main` deploys the
  migration; the run shows under the repo's **Actions** tab, and if it fails
  the migration did NOT apply. (`npm run db:push` exists but requires
  `SUPABASE_DB_URL` in `.env.local`, which is deliberately absent.)

## Feature flags

`src/lib/flags.js`. `VITE_FEATURE_SKY` / `VITE_FEATURE_STICKERS`: explicit
`'true'`/`'false'` wins; unset = on in dev, off in prod builds. The committed
`.env.production` pins both `true` for deploys and **outranks `.env.local`**
in `vite build`, so a local setting can't leak into prod.
`VITE_FEATURE_STICKERS=demo` runs the full sticker UI against localStorage
instead of the database (for previewing mechanics); demo mode disables the
caption→note conversion because that would write a real memento.

## Code conventions

- **No Tailwind.** One `.module.css` per component. The design system (colors,
  fonts, shadows) is in `src/styles/tokens.css` — use the CSS variables.
- Cormorant Garamond is reserved for card backs; UI uses DM Sans, display uses
  Playfair Display. Card backs are always warm cream. The dark "chain" color
  belongs to the nav and the + button (the Sparks Sky's warm near-black panel
  is the one sanctioned exception).
- Mementos store position as normalized 0–1 floats (`pos_x`, `pos_y`) on a
  3200×2600 virtual canvas. `Board.jsx` owns the pan/zoom transform in
  `tx.current`; screen↔canvas math is done arithmetically against it, not via
  DOM rects.
- **Partner colors are never stored per-row.** Everything renders color from
  `author_id` at draw time via `src/lib/partnerColors.js`, which maps the six
  known `profiles.accent_color` hexes to CSS custom properties
  (`--terracotta`, `--brass`, `--sage`, `--plum`, `--slate`, `--sienna`) and
  passes unknown hexes through raw. Keep that map in sync with
  `SettingsSheet`'s palette and `tokens.css`.
- **A sticker is never a first-class object**: it exists only attached to a
  parent memento (0–1 face anchors, cascade delete), rendered inside
  `MementoCard`'s wrapper so it inherits drag/pan/zoom/rotation, and placed via
  `pickStickerAnchor` (snaps to a band along the card edges, dodges existing
  stickers). Captions hard-cap at 60 chars — past that the composer offers to
  create a real note instead. Notes stay first-class mementos.
- Sparks Sky derives entirely from the sparks list already in memory (the app
  loads the couple's full history — it's a two-person app). Sky logic lives in
  pure functions in `src/lib/sky.js`, grouped in the viewer's local timezone.
  Keep the sky quiet: no axis labels, no counters-as-scores, no streaks, no
  gamification anywhere in the app.
- See `README.md` → "Architecture" and "Notes for contributors" for the rest.

## Hard-won platform gotchas (do not relearn these)

- **iOS keyboard vs fixed sheets**: the app is sized with static `dvh` so the
  keyboard overlays a motionless UI; compact input sheets lift above the
  keyboard with `--kb-vh` (set from `visualViewport` in `App.jsx`). iOS *also*
  scrolls the page to reveal a focused input and the two corrections stack —
  any new sheet containing an input must pin page scroll back to 0 while open
  (see `StickerComposer.jsx`) and let a mid-section (e.g. the emoji grid) be
  the flex child that shrinks/scrolls. Never let the input itself get squeezed.
- **iOS password autofill**: the username field needs
  `autocomplete="username"` (NOT `"email"`), `name` attributes on both fields,
  and the password field remounted (`key={mode}`) when toggling
  signin/signup. Safari's Save Password prompt on an SPA login needs `blur()`
  + `history.pushState` after success (see `SignIn.jsx`).
- **CSS `var()` does not resolve in SVG presentation attributes** — write
  `style={{ fill: color }}`, never `fill={color}`, when the color is a token.
- **Framer Motion `AnimatePresence`**: direct children must be keyed
  `motion.*` components or exit animations silently don't run. Static
  positioning transforms conflict with animated ones — split them across
  nested elements (outer static translate, inner animated scale).
- Realtime child-table updates use the refetch-per-parent pattern
  (`stickers`, `memento_photos`, `memento_list_items` in `useMementos`); RLS
  scopes the events to the partnership. Optimistic local writes go through the
  `addLocal`/`updateLocal` callbacks threaded down from `AppShell`.

## How to work here

Read the relevant files before changing them; keep changes scoped; prefer the
existing patterns in `src/lib`, `src/hooks`, and `src/components`. Prioritize
emotional UX and simplicity — this is a keepsake box for two people, and every
change should leave it feeling like one.
