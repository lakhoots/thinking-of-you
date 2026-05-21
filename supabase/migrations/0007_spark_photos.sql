-- Multi-photo support for sparks. Mirrors memento_photos: a per-spark
-- table of image rows with position-based ordering. The cover URL is
-- denormalized onto sparks.image_url for the feed render fast path,
-- the same way mementos do it.

create table public.spark_photos (
  id          uuid primary key default gen_random_uuid(),
  spark_id    uuid not null references public.sparks(id) on delete cascade,
  image_url   text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index spark_photos_spark_idx on public.spark_photos (spark_id, position);

alter table public.spark_photos enable row level security;

create policy "spark_photos_partner_read"
  on public.spark_photos for select
  using (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

create policy "spark_photos_author_insert"
  on public.spark_photos for insert
  with check (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.author_id = auth.uid()
        and s.partnership_id = public.current_partnership_id()
    )
  );

create policy "spark_photos_author_update"
  on public.spark_photos for update
  using (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.author_id = auth.uid()
    )
  );

create policy "spark_photos_author_delete"
  on public.spark_photos for delete
  using (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.author_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.spark_photos;
