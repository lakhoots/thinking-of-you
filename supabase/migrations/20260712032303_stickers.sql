-- Made Me Think of You — stickers: emoji reactions doodled onto mementos
--
-- A sticker is never a first-class object. It exists only attached to a
-- parent memento, positioned relative to that card (anchor_x/anchor_y are
-- 0–1 fractions of the card face), and it cascade-deletes with the parent.
-- Notes remain first-class mementos; a sticker caption is hard-capped at
-- 60 characters — anything longer belongs on a note.
--
-- rotation is a small random tilt set once at creation and persisted, so
-- the sticker looks identical to both partners forever.

create table public.stickers (
  id          uuid primary key default gen_random_uuid(),
  memento_id  uuid not null references public.mementos(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  caption     text check (char_length(caption) <= 60),
  anchor_x    real not null check (anchor_x between 0 and 1),
  anchor_y    real not null check (anchor_y between 0 and 1),
  rotation    real not null default 0,
  created_at  timestamptz not null default now()
);

create index stickers_memento_idx on public.stickers (memento_id);

alter table public.stickers enable row level security;

-- Both partners may read and place stickers on any memento in their
-- partnership (reactions are for each other's pins as much as your own).
-- Only the author may peel their own sticker off; stickers are not edited
-- after creation (delete + re-add instead), so no update policy.
create policy "stickers_partner_read"
  on public.stickers for select
  using (
    exists (
      select 1 from public.mementos m
      where m.id = stickers.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "stickers_author_insert"
  on public.stickers for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.mementos m
      where m.id = stickers.memento_id
        and m.partnership_id = public.current_partnership_id()
    )
  );

create policy "stickers_author_delete"
  on public.stickers for delete
  using (author_id = auth.uid());

alter publication supabase_realtime add table public.stickers;
