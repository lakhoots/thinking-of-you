-- Made Me Think of You — initial schema, RLS, realtime, storage
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--   Safe to run on a fresh project. Not idempotent — do not re-run on a populated DB.

-- ─────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────

create table public.partnerships (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  partner_a_id  uuid,
  partner_b_id  uuid,
  invite_token  text unique not null default replace(gen_random_uuid()::text, '-', ''),
  status        text not null default 'pending' check (status in ('pending', 'active')),
  created_at    timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  name            text not null,
  photo_url       text,
  accent_color    text not null default '#9C5E4A',
  partnership_id  uuid references public.partnerships(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Add the deferred partner FKs now that profiles exists.
alter table public.partnerships
  add constraint partnerships_partner_a_fk
    foreign key (partner_a_id) references public.profiles(id) on delete set null,
  add constraint partnerships_partner_b_fk
    foreign key (partner_b_id) references public.profiles(id) on delete set null;

create table public.mementos (
  id              uuid primary key default gen_random_uuid(),
  partnership_id  uuid not null references public.partnerships(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in ('photo', 'note', 'emoji')),
  date            date not null,
  title           text,
  note            text,
  image_url       text,
  emoji           text,
  pos_x           float not null default 0.5,
  pos_y           float not null default 0.5,
  rotation        float not null default 0,
  created_at      timestamptz not null default now()
);

create index mementos_partnership_idx on public.mementos (partnership_id, created_at desc);

create table public.sparks (
  id              uuid primary key default gen_random_uuid(),
  partnership_id  uuid not null references public.partnerships(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  note            text not null,
  date            date not null default current_date,
  image_url       text,
  emoji           text,
  created_at      timestamptz not null default now()
);

create index sparks_partnership_idx on public.sparks (partnership_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- Helper: current user's partnership_id (used in all RLS policies)
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.current_partnership_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partnership_id from public.profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.partnerships  enable row level security;
alter table public.mementos      enable row level security;
alter table public.sparks        enable row level security;

-- Profiles: see your own + your partner's. Modify only your own.
create policy "profiles_self_read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_partner_read"
  on public.profiles for select
  using (partnership_id is not null and partnership_id = public.current_partnership_id());

create policy "profiles_self_insert"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Partnerships:
--   read: rows you belong to OR a pending row matched via invite_token
--   insert: the creator must be partner_a (i.e. you)
--   update: only the partners on the row may update it
create policy "partnerships_member_read"
  on public.partnerships for select
  using (
    partner_a_id = auth.uid()
    or partner_b_id = auth.uid()
  );

create policy "partnerships_creator_insert"
  on public.partnerships for insert
  with check (partner_a_id = auth.uid());

create policy "partnerships_member_update"
  on public.partnerships for update
  using (partner_a_id = auth.uid() or partner_b_id = auth.uid())
  with check (partner_a_id = auth.uid() or partner_b_id = auth.uid());

-- Mementos: only your partnership, only your own as author for writes.
create policy "mementos_partner_read"
  on public.mementos for select
  using (partnership_id = public.current_partnership_id());

create policy "mementos_author_insert"
  on public.mementos for insert
  with check (
    partnership_id = public.current_partnership_id()
    and author_id = auth.uid()
  );

create policy "mementos_author_update"
  on public.mementos for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "mementos_author_delete"
  on public.mementos for delete
  using (author_id = auth.uid());

-- Sparks: same shape as mementos
create policy "sparks_partner_read"
  on public.sparks for select
  using (partnership_id = public.current_partnership_id());

create policy "sparks_author_insert"
  on public.sparks for insert
  with check (
    partnership_id = public.current_partnership_id()
    and author_id = auth.uid()
  );

create policy "sparks_author_update"
  on public.sparks for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "sparks_author_delete"
  on public.sparks for delete
  using (author_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Invite-token RPC — atomic join. Bypasses partnerships SELECT policy
-- so the invitee can find the pending partnership by its token.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.join_partnership_by_token(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pship public.partnerships;
begin
  select * into pship from public.partnerships where invite_token = token;
  if not found then
    raise exception 'Invite token not found';
  end if;

  if pship.partner_a_id = auth.uid() then
    return pship.id;
  end if;

  if pship.partner_b_id is not null and pship.partner_b_id <> auth.uid() then
    raise exception 'This partnership already has two members';
  end if;

  update public.partnerships
    set partner_b_id = auth.uid(), status = 'active'
    where id = pship.id;

  update public.profiles
    set partnership_id = pship.id
    where id = auth.uid();

  return pship.id;
end;
$$;

grant execute on function public.join_partnership_by_token(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ─────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.mementos;
alter publication supabase_realtime add table public.sparks;

-- ─────────────────────────────────────────────────────────────────────
-- Storage buckets — public read, authenticated write
-- ─────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public) values
  ('avatars',   'avatars',   true),
  ('mementos',  'mementos',  true),
  ('sparks',    'sparks',    true)
on conflict (id) do nothing;

create policy "avatars_public_read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "mementos_public_read"  on storage.objects for select using (bucket_id = 'mementos');
create policy "sparks_public_read"    on storage.objects for select using (bucket_id = 'sparks');

create policy "avatars_auth_write"  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "mementos_auth_write" on storage.objects for insert
  with check (bucket_id = 'mementos' and auth.role() = 'authenticated');
create policy "sparks_auth_write"   on storage.objects for insert
  with check (bucket_id = 'sparks' and auth.role() = 'authenticated');

create policy "avatars_auth_update"  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "mementos_auth_update" on storage.objects for update
  using (bucket_id = 'mementos' and auth.role() = 'authenticated');
create policy "sparks_auth_update"   on storage.objects for update
  using (bucket_id = 'sparks' and auth.role() = 'authenticated');
