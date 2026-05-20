-- Made Me Think of You — explicit stacking order for pins
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--
-- A card's `z` is bumped past the current max for its partnership whenever
-- it's moved in arrange mode, so the last thing you touched lands on top.
-- Sorting by z ascending (with created_at as a stable tiebreaker for
-- never-touched pins) gives the render order.

alter table public.mementos add column z bigint not null default 0;

create index mementos_z_idx on public.mementos (partnership_id, z asc, created_at asc);

create or replace function public.move_mementos(moves jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pship uuid;
  rec   record;
  max_z bigint;
  idx   bigint := 0;
begin
  pship := public.current_partnership_id();
  if pship is null then
    raise exception 'No partnership for current user';
  end if;

  select coalesce(max(z), 0) into max_z
    from public.mementos
    where partnership_id = pship;

  for rec in
    select
      (elem->>'id')::uuid          as id,
      (elem->>'pos_x')::float      as pos_x,
      (elem->>'pos_y')::float      as pos_y,
      (elem->>'rotation')::float   as rotation,
      (elem->>'scale')::float      as scale,
      (elem->>'scale_y')::float    as scale_y
    from jsonb_array_elements(moves) elem
  loop
    idx := idx + 1;
    update public.mementos
      set pos_x    = rec.pos_x,
          pos_y    = rec.pos_y,
          rotation = coalesce(rec.rotation, rotation),
          scale    = coalesce(rec.scale, scale),
          scale_y  = coalesce(rec.scale_y, scale_y),
          z        = max_z + idx
      where id = rec.id
        and partnership_id = pship;
  end loop;
end;
$$;
