-- Allow members to specify measurement time; identity grants and RLS stay unchanged.
begin;
grant insert (measured_at) on public.pressure_readings to authenticated;
commit;
