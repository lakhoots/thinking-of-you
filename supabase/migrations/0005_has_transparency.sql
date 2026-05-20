-- Made Me Think of You — track which photos have an alpha channel
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--
-- Photos uploaded with a transparent background (tickets, cut-outs)
-- render borderless on the board so they look like the object itself,
-- not a framed photograph. We detect transparency at upload time and
-- store the flag per-photo; the memento-level flag mirrors the cover.

alter table public.memento_photos add column has_transparency boolean not null default false;
alter table public.mementos       add column has_transparency boolean not null default false;
