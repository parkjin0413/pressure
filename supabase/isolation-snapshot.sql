-- Structural snapshot only: no application records or credentials.
select jsonb_build_object(
  'existing_tables', (select jsonb_agg(jsonb_build_object(
    'name', c.relname, 'rls', c.relrowsecurity, 'acl', c.relacl,
    'columns', (select jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid,a.atttypmod), 'not_null', a.attnotnull) order by a.attnum)
      from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname not like 'pressure\_%' escape '\'),
  'existing_policies', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', p.polname, 'command', p.polcmd,
    'using', pg_get_expr(p.polqual,p.polrelid),
    'check', pg_get_expr(p.polwithcheck,p.polrelid)) order by c.relname,p.polname),'[]')
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname not like 'pressure\_%' escape '\'),
  'auth_triggers', (select coalesce(jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname),'[]')
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and not t.tgisinternal)
) as snapshot;
