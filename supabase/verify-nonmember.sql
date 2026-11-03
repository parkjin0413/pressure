-- Simulate an authenticated nonmember without leaving data behind.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
begin
  if exists(select 1 from public.pressure_members) then
    raise exception 'Nonmember can read pressure membership';
  end if;
  if exists(select 1 from public.pressure_readings) then
    raise exception 'Nonmember can read pressure records';
  end if;
  begin
    insert into public.pressure_readings(systolic,diastolic) values(120,80);
    raise exception 'Nonmember insertion unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
rollback;
select 'Nonmember read and insert isolation verified' as result;
