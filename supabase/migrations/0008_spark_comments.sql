-- Comments on sparks. Both partners can read and add comments within
-- their own partnership; comments are removed when the spark is deleted.

create table public.spark_comments (
  id          uuid primary key default gen_random_uuid(),
  spark_id    uuid not null references public.sparks(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index spark_comments_spark_idx on public.spark_comments (spark_id, created_at);

alter table public.spark_comments enable row level security;

create policy "spark_comments_partner_read"
  on public.spark_comments for select
  using (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

create policy "spark_comments_partner_insert"
  on public.spark_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

alter publication supabase_realtime add table public.spark_comments;
