# SymmetricDS replication notes

Mac is `client:mac-node`, Windows is `server:win-node`.

Business replication is configured with explicit triggers for every non-`sym_*`
table in `public`. The old `public.*` wildcard should not be used because this
database also contains SymmetricDS system tables.

## Re-apply Mac trigger config

```sh
PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d Segmentica \
  -f infra/symmetricds/configure-bidirectional-business-triggers.sql

docker exec segmentica-symmetricds \
  /opt/symmetricds/bin/symadmin sync-triggers --engine node-mac --force
```

For the Bitrix import table, there is also an explicit id-stable config:

```sh
PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d Segmentica \
  -f infra/symmetricds/configure-imported-requests-replication.sql

docker exec segmentica-symmetricds \
  /opt/symmetricds/bin/symadmin sync-triggers --engine node-mac --force
```

Expected Mac-side counts:

```sql
select count(*) from sym_trigger where source_table_name not like 'sym\_%' escape '\';
select count(*) from sym_trigger_router;
```

Every business table should have one trigger and two trigger-router links.

## Seed Windows from Mac

Schema was sent from Mac to Windows with `symadmin send-schema`.

If Windows needs the current Mac data as the first full copy, run this on the
Windows SymmetricDS host:

```sh
docker compose exec -T symmetricds \
  /opt/symmetricds/bin/symadmin reload-node --engine node-win --reverse mac-node
```

Then watch both sides:

```sh
docker compose logs -f symmetricds
```

On Mac:

```sh
docker compose logs -f symmetricds
docker compose exec -T symmetricds \
  /opt/symmetricds/bin/symadmin run-job pull --engine node-mac
```

## Backup files

Generated fallback files are in `backups/postgres`:

- `Segmentica-public-business-schema.sql` - schema only, without `sym_*`
- `Segmentica-business-full.dump` - custom-format schema + data, without `sym_*`
- `symmetric-config-before-business-triggers.sql` - old SymmetricDS config backup
