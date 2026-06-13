-- Made Me Think of You — small thumbnails for fast board render
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--   Safe to run on top of earlier migrations. Not idempotent.
--
-- The board and sparks feed were loading the full ~1600px upload for every
-- card. We now generate a smaller thumbnail at upload time and store its URL
-- alongside the full image. The board pins and feed photos read thumb_url;
-- the lightbox/detail carousel keeps using the full image_url.
-- Nullable: legacy photos have no thumb and fall back to image_url.

alter table public.memento_photos add column thumb_url text;
alter table public.mementos       add column thumb_url text;

alter table public.spark_photos add column thumb_url text;
alter table public.sparks       add column thumb_url text;
