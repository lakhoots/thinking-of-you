-- Made Me Think of You — themed lists on the board
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--   Safe to run on top of 0009. Not idempotent.
--
-- A "list" memento is a themed sticker on the board (movies, dishes, …) that
-- flips open to a running checklist. Unlike photos/notes, the *items* are a
-- shared surface: either partner can add, check off, edit, or remove them
-- (partner-scoped RLS, like spark_comments), so the list stays a joint
-- running list. The list container itself (title, theme, sticker image) keeps
-- the author-only write rules every memento has.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Allow the new memento type + carry the chosen theme.
--    A custom sticker image reuses the existing image_url / has_transparency
--    columns and the `mementos` storage bucket — no new column or bucket.
-- ─────────────────────────────────────────────────────────────────────

alter table public.mementos drop constraint mementos_type_check;
alter table public.mementos
  add constraint mementos_type_check
  check (type in ('photo', 'note', 'emoji', 'list'));

alter table public.mementos add column list_theme text;

-- ─────────────────────────────────────────────────────────────────────
-- 2. List items — one row per checklist entry, ordered by position.
-- ─────────────────────────────────────────────────────────────────────

create table public.memento_list_items (
  id          uuid primary key default gen_random_uuid(),
  memento_id  uuid not null references public.mementos(id) on delete cascade,
  text        text not null check (char_length(trim(text)) > 0),
  checked     boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index memento_list_items_memento_idx
  on public.memento_list_items (memento_id, position);

alter table public.memento_list_items enable row level security;

-- Both partners may read AND write items within their partnership — the list
-- is a shared running list, not author-owned. (Contrast memento_photos, which
-- is author-only.)
create policy "list_items_partner_read"
  on public.memento_list_items for select
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_list_items.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "list_items_partner_insert"
  on public.memento_list_items for insert
  with check (
    exists (
      select 1 from public.mementos m
      where m.id = memento_list_items.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "list_items_partner_update"
  on public.memento_list_items for update
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_list_items.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  )
  with check (
    exists (
      select 1 from public.mementos m
      where m.id = memento_list_items.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "list_items_partner_delete"
  on public.memento_list_items for delete
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_list_items.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

alter publication supabase_realtime add table public.memento_list_items;
