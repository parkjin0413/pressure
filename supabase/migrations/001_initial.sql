-- Run once in the Supabase SQL Editor. Sign-ups should be disabled in Auth settings.
begin;

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30)
);
alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
create policy "Members see their membership" on public.members
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  systolic integer not null check (systolic between 40 and 300),
  diastolic integer not null check (diastolic between 20 and 200),
  pulse integer check (pulse between 20 and 250),
  note text not null default '' check (char_length(note) <= 300),
  measured_at timestamptz not null default now(),
  constraint valid_pressure_order check (systolic > diastolic)
);
create index readings_user_measured_idx on public.readings (user_id, measured_at desc, id);
alter table public.readings enable row level security;
revoke all on public.readings from anon, authenticated;
grant select, delete on public.readings to authenticated;
-- Clients cannot supply or change identity or measurement time.
grant insert (systolic, diastolic, pulse, note) on public.readings to authenticated;

create policy "Members read own records" on public.readings
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.members where user_id = (select auth.uid())
    )
  );
create policy "Members insert own records" on public.readings
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.members where user_id = (select auth.uid())
    )
  );
create policy "Members delete own records" on public.readings
  for delete to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.members where user_id = (select auth.uid())
    )
  );
commit;
