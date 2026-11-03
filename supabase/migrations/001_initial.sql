-- Shared work project: only pressure_* objects are created.
-- Do not change shared Auth settings, Site URL, existing grants, or other tables.
begin;

create table public.pressure_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30)
);
alter table public.pressure_members enable row level security;
revoke all on public.pressure_members from public, anon, authenticated;
grant select on public.pressure_members to authenticated;
create policy "Pressure members see their membership" on public.pressure_members
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.pressure_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  systolic integer not null check (systolic between 40 and 300),
  diastolic integer not null check (diastolic between 20 and 200),
  pulse integer check (pulse between 20 and 250),
  note text not null default '' check (char_length(note) <= 300),
  measured_at timestamptz not null default now(),
  constraint valid_pressure_order check (systolic > diastolic)
);
create index pressure_readings_user_measured_idx on public.pressure_readings (user_id, measured_at desc, id);
alter table public.pressure_readings enable row level security;
revoke all on public.pressure_readings from public, anon, authenticated;
grant select, delete on public.pressure_readings to authenticated;
-- Clients cannot supply or change identity or measurement time.
grant insert (systolic, diastolic, pulse, note) on public.pressure_readings to authenticated;

create policy "Pressure members read own records" on public.pressure_readings
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.pressure_members where user_id = (select auth.uid())
    )
  );
create policy "Pressure members insert own records" on public.pressure_readings
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.pressure_members where user_id = (select auth.uid())
    )
  );
create policy "Pressure members delete own records" on public.pressure_readings
  for delete to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.pressure_members where user_id = (select auth.uid())
    )
  );
commit;
