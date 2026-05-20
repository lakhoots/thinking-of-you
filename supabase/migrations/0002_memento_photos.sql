-- Made Me Think of You — multi-photo pins + shared move RPC
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--   Safe to run on top of 0001_init.sql. Not idempotent.

-- ─────────────────────────────────────────────────────────────────────
-- memento_photos: one memento can carry 1..N photos in a stack
-- ─────────────────────────────────────────────────────────────────────

create table public.memento_photos (
  id          uuid primary key default gen_random_uuid(),
  memento_id  uuid not null references public.mementos(id) on delete cascade,
  image_url   text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index memento_photos_memento_idx
  on public.memento_photos (memento_id, position);

alter table public.memento_photos enable row level security;

create policy "memento_photos_partner_read"
  on public.memento_photos for select
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_photos.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "memento_photos_author_insert"
  on public.memento_photos for insert
  with check (
    exists (
      select 1 from public.mementos m
      where m.id = memento_photos.memento_id
        and m.author_id = auth.uid()
    )
  );

create policy "memento_photos_author_update"
  on public.memento_photos for update
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_photos.memento_id
        and m.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mementos m
      where m.id = memento_photos.memento_id
        and m.author_id = auth.uid()
    )
  );

create policy "memento_photos_author_delete"
  on public.memento_photos for delete
  using (
    exists (
      select 1 from public.mementos m
      where m.id = memento_photos.memento_id
        and m.author_id = auth.uid()
    )
  );

-- Backfill: every existing photo memento with an image_url becomes a single-photo stack.
insert into public.memento_photos (memento_id, image_url, position)
select id, image_url, 0
from public.mementos
where type = 'photo' and image_url is not null;

alter publication supabase_realtime add table public.memento_photos;

-- ─────────────────────────────────────────────────────────────────────
-- move_mementos: either partner can reposition any pin in their
-- partnership. Author-only RLS on the table stays intact for all other
-- updates — this RPC is the only path for shared moves.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.move_mementos(moves jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pship uuid;
  rec   record;
begin
  pship := public.current_partnership_id();
  if pship is null then
    raise exception 'No partnership for current user';
  end if;

  for rec in
    select
      (elem->>'id')::uuid          as id,
      (elem->>'pos_x')::float      as pos_x,
      (elem->>'pos_y')::float      as pos_y,
      (elem->>'rotation')::float   as rotation
    from jsonb_array_elements(moves) elem
  loop
    update public.mementos
      set pos_x    = rec.pos_x,
          pos_y    = rec.pos_y,
          rotation = coalesce(rec.rotation, rotation)
      where id = rec.id
        and partnership_id = pship;
  end loop;
end;
$$;

grant execute on function public.move_mementos(jsonb) to authenticated;
