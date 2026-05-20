-- Made Me Think of You — separate Y-axis scale + RPC update
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--
-- Note pins (type='note') use scale + scale_y independently so the box
-- can change aspect ratio and show more text. Photo/emoji pins keep both
-- in sync — they always resize uniformly.

alter table public.mementos add column scale_y float not null default 1.0;

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
      (elem->>'scale')::float      as scale,
      (elem->>'scale_y')::float    as scale_y
    from jsonb_array_elements(moves) elem
  loop
    update public.mementos
      set pos_x    = rec.pos_x,
          pos_y    = rec.pos_y,
          rotation = coalesce(rec.rotation, rotation),
          scale    = coalesce(rec.scale, scale),
          scale_y  = coalesce(rec.scale_y, scale_y)
      where id = rec.id
        and partnership_id = pship;
  end loop;
end;
$$;
