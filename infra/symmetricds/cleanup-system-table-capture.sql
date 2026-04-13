-- Remove stale capture state created by the temporary public.* wildcard.
-- SymmetricDS tables should not have replication triggers.

begin;

update sym_trigger_hist
set inactive_time = current_timestamp
where coalesce(source_schema_name, 'public') = 'public'
  and source_table_name like 'sym\_%' escape '\'
  and inactive_time is null;

do $$
declare
    rec record;
begin
    for rec in
        select
            n.nspname as schema_name,
            c.relname as table_name,
            t.tgname as trigger_name
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal
          and n.nspname = 'public'
          and c.relname like 'sym\_%' escape '\'
          and lower(t.tgname) like 'sym_on_%'
    loop
        execute format(
            'drop trigger if exists %I on %I.%I',
            rec.trigger_name,
            rec.schema_name,
            rec.table_name
        );
    end loop;
end $$;

commit;
