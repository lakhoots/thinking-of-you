-- Seen receipts for sparks. Each user has at most one view row per spark,
-- updated whenever the spark becomes visible in their feed.

create table public.spark_views (
  id       uuid primary key default gen_random_uuid(),
  spark_id uuid not null references public.sparks(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  seen_at  timestamptz not null default now(),
  unique (spark_id, user_id)
);

create index spark_views_spark_idx on public.spark_views (spark_id, seen_at desc);
create index spark_views_user_idx on public.spark_views (user_id, seen_at desc);

alter table public.spark_views enable row level security;

create policy "spark_views_partner_read"
  on public.spark_views for select
  using (
    exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

create policy "spark_views_self_insert"
  on public.spark_views for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

create policy "spark_views_self_update"
  on public.spark_views for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sparks s
      where s.id = spark_id
        and s.partnership_id = public.current_partnership_id()
    )
  );

alter publication supabase_realtime add table public.spark_views;
