# Experiment notes — Sparks Sky + Stickers

Branch: `experiment/sky-stickers`. Both features are gated by
`VITE_FEATURE_SKY` / `VITE_FEATURE_STICKERS` (`src/lib/flags.js`): an explicit
`'true'`/`'false'` wins; unset means **on in dev, off in production builds**.
So merging this branch ships nothing visible until the env vars flip on.

`VITE_FEATURE_STICKERS=demo` is a third state: the full sticker UI runs, but
stickers live in the browser's localStorage instead of the database — for
previewing the mechanics on the real board before the migration is applied.
Demo stickers are visible only in that browser; the note-conversion affordance
is disabled there (it would write a real note). Flip `demo` → unset/`true`
once the migration ships; stale demo stickers are simply ignored (they're
never merged in non-demo mode) and can be cleared by removing the
`mmtoy-demo-stickers` localStorage key.

## Decisions and deviations from the brief

### Partner colors: kept the existing hex system

The brief asked for a semantic color key (`"coral"`) mapped to hex in
`tokens.css`. The app already had a complete partner-color system the brief
didn't anticipate: `profiles.accent_color` stores a hex, **users already pick
their color in Settings** (six named options, with a "that's your partner's
colour" warning), and every component resolves color from `author_id` at
render time. Migrating to semantic keys would have meant a data backfill and
rewriting a working, user-facing picker to gain a light/dark indirection the
app can't use — there is no dark theme (`tokens.css` is deliberately a single
warm palette; "card backs are always cream" is a design law here). So:

- Colors stay hex in `profiles.accent_color` (no migration, no picker churn).
- New shared code path: `src/lib/partnerColors.js` (`colorForUser(userId,
  partners)`). Both features derive color from `author_id` at render time;
  color is never stored per-row — the brief's actual invariant, which is
  preserved. Changing your accent repaints your whole history everywhere.
- Inside the helper, the six known palette hexes map to CSS custom
  properties (`--terracotta`, `--brass`, `--sage`, `--plum`, `--slate`,
  `--sienna` in `tokens.css`); an unknown hex passes through as-is. So a
  future dark mode or key migration only touches the hook + tokens, not the
  consumers. One gotcha this surfaced: `var()` doesn't resolve in SVG
  presentation attributes, so the sky dots set fill via `style`.
- The "light and dark token themes" acceptance criterion is moot for the same
  reason. The sky panel is a warm near-black from the chain family, on the
  parchment page — it reads as one theme, by design.

### Sky: no month cache, no per-month queries

The brief assumed month-range queries plus an in-memory cache. In reality
`listSparks` already loads the couple's entire spark history into memory (it's
a two-person app; hundreds of rows, not millions), and the feed's realtime
subscription keeps it fresh. `SparksSky` is therefore a **pure projection of
the sparks the feed already holds** — no fetching, no cache Map, no extra
subscription. Month flips are instant; a realtime spark in the visible month
mounts a dot with the spring-in animation for free. If the history ever grows
past what one query should carry, pagination belongs in `listSparks`, not in
the sky.

Grouping/layout is all pure functions in `src/lib/sky.js` (viewer's local
timezone via plain `Date` methods), so it's trivially testable — though note
this repo has no test runner; adding one just for this felt out of scope.

### Sky: quietness choices

- No axis labels, no gridlines, no day numbers. A tiny time axis would have
  made it a chart; without one it stays a sky you slowly learn to read.
- Constellation lines connect a day's dots sorted by time, only when **both**
  partners sparked that local calendar day (`authors.size >= 2` — for two
  people that's exactly "both").
- Empty month copy: *"A quiet month — just open sky."* No CTA.
- Entry point: a small stars icon in the Sparks header. No new route — the
  app is tab-based with zero sub-routes, so the sky is a local view state,
  matching how everything else works (sheets, not pages).

### Stickers: schema and RLS

Migration `20260712032303_stickers.sql`, modeled on `memento_list_items`:

- Partnership-scoped `select`/`insert` via the parent memento join; `insert`
  additionally requires `author_id = auth.uid()`.
- **No update policy at all** — stickers are placed once (delete + re-add is
  the edit path, per the brief), so the DB simply doesn't allow updates.
- `delete` is author-only.
- `on delete cascade` from mementos: peel-with-parent is structural.
- The emoji column check is `char_length(emoji) between 1 and 16` — "1–3
  emoji" isn't expressible cheaply in SQL (ZWJ sequences), so the DB bounds
  the size and the client's curated picker enforces the spirit (max 3 picks).
- The 60-char caption cap is enforced three times: DB check, lib guard, and
  the composer UI.

### Stickers: rendering approach

Stickers render **inside `MementoCard`'s positioned wrapper**, so drag, pan,
zoom, and card rotation carry them along with zero extra math. Consequences:

- On non-note cards (which scale via CSS transform) stickers scale with the
  card. On notes (which resize their box so text reflows) stickers keep their
  size. Slightly inconsistent, visually fine in practice.
- Stickers are treated as **front-face marginalia**: they fade out while the
  card is flipped rather than mirroring or overlaying the back. The back
  stays clean cream, per the design rules.
- A sticker's own ±5° tilt is generated once at creation and persisted
  (`rotation`), so both partners forever see the same slightly-crooked thing.

### Stickers: interactions

- **Add**: long-press (450 ms) on a card — same gesture with a mouse. The
  press point is inverse-transformed (canvas pan/zoom → card rotation →
  card scale) into 0–1 face anchors. The composer opens under the still-held
  finger, so its tap-away dismissal is disarmed for the first 400 ms.
- A dedicated hover affordance for desktop was skipped — press-and-hold works
  fine with a mouse and one gesture on both platforms is simpler. Revisit if
  it proves undiscoverable.
- **Overflow**: a card shows 5 stickers (was 3; felt too eager to hide);
  the rest collapse into a `+N` chip that fans them out (staggered springs). The detail sheet lists all stickers
  with author + date, and that's also where "Peel off" (author-only delete)
  lives — a context action rather than drag-off, which would fight the
  board's pan gesture.
- **Caption overflow**: past 60 characters the composer disables "Stick it"
  and offers *"That's more than a sticker — turn it into a note?"* —
  conversion creates a real note memento placed near the parent (it reuses
  `pickPosition` with a small virtual rect around the parent card) and
  discards the sticker draft.

## Verified

- `npm run lint` (no new issues; the repo has pre-existing errors on `main`)
  and `npm run build` pass.
- Visually exercised with mock data in a throwaway sandbox (not committed):
  sky dots/constellations/bloom/month paging/empty state; sticker anatomy,
  fan-out, flip-fade; composer picker, over-cap conversion affordance.

**Not yet verified against a live database** (needs the migration applied and
two signed-in partners): realtime sticker arrival timing, cascade delete,
RLS behavior, long-press feel on an actual phone, and the "<100 ms with 200+
sparks" bound (nothing in the render path scales worse than linearly, so it
should be comfortable).

## What felt off / open questions

- **Does the sky feel like a keepsake or a chart?** With labels omitted it
  leans keepsake — the constellation lines are the emotional payload, and on
  sparse months the emptiness genuinely reads as honest texture rather than
  failure. The risk is the opposite: without any time cue, the y-axis meaning
  ("late-night dots sit low") has to be discovered. I'd rather teach it once
  in the empty state copy than add an axis.
- **The 60-char cap feels right**, mostly because the conversion affordance
  makes hitting it feel like a door opening rather than a wall. The one part
  that might chafe: conversion discards the emoji. Arguably the note should
  inherit it somehow, but notes have no emoji slot and inventing one for this
  felt like scope creep.
- **Sticker size relative to cards**: at 18px emoji on a 138px-wide card,
  stickers are prominent — marginalia that competes a little with the
  memento itself when several pile on. Real use said hide *less*, not more
  (`MAX_VISIBLE` went 3 → 5); if a full card feels loud, scale bubbles down
  ~15% rather than lowering the cap again.
- Time-of-day mapping is linear over 24h; compressing 01:00–06:00 (per the
  brief's "later") would lift the dead band most skies will have.
