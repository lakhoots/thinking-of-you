-- Made Me Think of You — per-memento scale + RPC update
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.

alter table public.mementos add column scale float not null default 1.0;

-- Replace move_mementos so the same RPC also handles scale, keeping
-- "shared arrangement" (move + rotate + resize by either partner) on
-- one path. Rotation and scale are still optional — coalesce keeps the
-- existing value when the caller omits the key.
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
      (elem->>'rotation')::float   as rotation,
      (elem->>'scale')::float      as scale
    from jsonb_array_elements(moves) elem
  loop
    update public.mementos
      set pos_x    = rec.pos_x,
          pos_y    = rec.pos_y,
          rotation = coalesce(rec.rotation, rotation),
          scale    = coalesce(rec.scale, scale)
      where id = rec.id
        and partnership_id = pship;
  end loop;
end;
$$;
