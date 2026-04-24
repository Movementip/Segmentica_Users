-- Configure explicit two-way replication for Bitrix imported requests.
-- Keep trigger_id aligned with the Windows node.

begin;

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
values (
    'rep_imported_requests',
    'public',
    'imported_requests',
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
    'Two-way replication for public.imported_requests'
)
on conflict (trigger_id) do update set
    source_schema_name = excluded.source_schema_name,
    source_table_name = excluded.source_table_name,
    channel_id = excluded.channel_id,
    reload_channel_id = excluded.reload_channel_id,
    sync_on_update = excluded.sync_on_update,
    sync_on_insert = excluded.sync_on_insert,
    sync_on_delete = excluded.sync_on_delete,
    sync_on_incoming_batch = excluded.sync_on_incoming_batch,
    use_stream_lobs = excluded.use_stream_lobs,
    use_capture_lobs = excluded.use_capture_lobs,
    use_capture_old_data = excluded.use_capture_old_data,
    use_handle_key_updates = excluded.use_handle_key_updates,
    stream_row = excluded.stream_row,
    last_update_by = excluded.last_update_by,
    last_update_time = excluded.last_update_time,
    description = excluded.description;

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
    'rep_imported_requests',
    router_id,
    1,
    1000,
    current_timestamp,
    'codex',
    current_timestamp
from sym_router
where router_id in ('client to server', 'server to client')
on conflict (trigger_id, router_id) do update set
    enabled = excluded.enabled,
    initial_load_order = excluded.initial_load_order,
    last_update_by = excluded.last_update_by,
    last_update_time = excluded.last_update_time;

commit;
