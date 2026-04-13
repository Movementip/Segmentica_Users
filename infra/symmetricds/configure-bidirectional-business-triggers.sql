-- Configure full two-way replication for application tables in public schema.
-- SymmetricDS system tables (sym_*) are intentionally excluded.

begin;

with business_tables as (
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name not like 'sym\_%' escape '\'
), generated_triggers as (
    select
        'rep_' || left(md5('public.' || table_name), 24) as trigger_id,
        table_name
    from business_tables
)
delete from sym_trigger_router
where trigger_id = 'all_public_tables'
   or trigger_id like 'rep\_%' escape '\';

with business_tables as (
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name not like 'sym\_%' escape '\'
), generated_triggers as (
    select
        'rep_' || left(md5('public.' || table_name), 24) as trigger_id,
        table_name
    from business_tables
)
delete from sym_trigger
where trigger_id = 'all_public_tables'
   or trigger_id like 'rep\_%' escape '\';

with business_tables as (
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name not like 'sym\_%' escape '\'
), generated_triggers as (
    select
        'rep_' || left(md5('public.' || table_name), 24) as trigger_id,
        table_name
    from business_tables
)
insert into sym_trigger (
    trigger_id,
    source_schema_name,
    source_table_name,
    channel_id,
    reload_channel_id,
    sync_on_update,
    sync_on_insert,
    sync_on_delete,
    sync_on_incoming_batch,
    use_stream_lobs,
    use_capture_lobs,
    use_capture_old_data,
    use_handle_key_updates,
    stream_row,
    create_time,
    last_update_by,
    last_update_time,
    description
)
select
    trigger_id,
    'public',
    table_name,
    'default',
    'reload',
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    1,
    0,
    current_timestamp,
    'codex',
    current_timestamp,
    'Two-way replication for public.' || table_name
from generated_triggers
order by table_name;

insert into sym_trigger_router (
    trigger_id,
    router_id,
    enabled,
    initial_load_order,
    create_time,
    last_update_by,
    last_update_time
)
select
    t.trigger_id,
    r.router_id,
    1,
    row_number() over (partition by r.router_id order by t.source_table_name),
    current_timestamp,
    'codex',
    current_timestamp
from sym_trigger t
join sym_router r
  on r.router_id in ('client to server', 'server to client')
where t.trigger_id like 'rep\_%' escape '\';

commit;
