-- Run after setup. These read-only checks inspect security configuration.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('pressure_members', 'pressure_readings');

select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('pressure_members', 'pressure_readings');

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('pressure_members', 'pressure_readings')
  and grantee in ('anon', 'authenticated')
order by grantee, table_name, column_name, privilege_type;

select count(*) as registered_members from public.pressure_members;
-- Expected: 2 members; RLS true on both tables; anon has no grants;
-- authenticated can INSERT measured_at but cannot INSERT user_id or UPDATE any record.
