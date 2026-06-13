-- Favorites — small prompted love notes that complete the sentence
-- "right now, my favorite thing about you is …".
--
-- One "current" favorite per author is surfaced in the UI (the latest
-- row by created_at), but every entry is preserved here forever — a
-- future "replay" feature will recap the history and look for trends.
-- For that to work, the app must INSERT only: it must never UPDATE or
-- DELETE these rows. The policies below still permit it so the owner
-- can clean up via SQL in a pinch, but the lib layer omits both.

create table public.favorites (
  id              uuid primary key default gen_random_uuid(),
  partnership_id  uuid not null references public.partnerships(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(trim(body)) > 0),
  date            date not null default current_date,
  created_at      timestamptz not null default now()
);

create index favorites_partnership_idx
  on public.favorites (partnership_id, created_at desc);

alter table public.favorites enable row level security;

create policy "favorites_partner_read"
  on public.favorites for select
  using (partnership_id = public.current_partnership_id());

create policy "favorites_author_insert"
  on public.favorites for insert
  with check (
    partnership_id = public.current_partnership_id()
    and author_id = auth.uid()
  );

create policy "favorites_author_update"
  on public.favorites for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "favorites_author_delete"
  on public.favorites for delete
  using (author_id = auth.uid());

alter publication supabase_realtime add table public.favorites;
