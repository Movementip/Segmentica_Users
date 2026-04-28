import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient } from 'pg';
import { getRequestContext } from './requestContext';
const globalForDb = globalThis as typeof globalThis & {
    __segmenticaDbPool?: Pool | null;
    __segmenticaDbPoolPromise?: Promise<Pool> | null;
    __segmenticaLocalDbPool?: Pool | null;
    __segmenticaLocalDbPoolPromise?: Promise<Pool> | null;
    __segmenticaDbCheckInterval?: NodeJS.Timeout | null;
    __segmenticaDbExitHandlerRegistered?: boolean;
    __segmenticaDbResetPromise?: Promise<void> | null;
    __segmenticaPgCryptoEnsurePromise?: Promise<void> | null;
};
export let isRemote = false;
export type DbMode = 'local' | 'remote';
export let dbMode: DbMode = 'local';
export let remoteAvailable = false;
let checkInterval: NodeJS.Timeout | null = globalForDb.__segmenticaDbCheckInterval ?? null;
let resetPoolPromise: Promise<void> | null = globalForDb.__segmenticaDbResetPromise ?? null;
let pgCryptoEnsurePromise: Promise<void> | null = globalForDb.__segmenticaPgCryptoEnsurePromise ?? null;

type DatabaseSslConfig = false | { rejectUnauthorized: boolean };

const isEnabledEnvFlag = (value?: string | null): boolean => {
    return ['1', 'true', 'yes', 'require', 'required', 'on'].includes(String(value || '').trim().toLowerCase());
};

const isDisabledEnvFlag = (value?: string | null): boolean => {
    return ['0', 'false', 'no', 'disable', 'disabled', 'off'].includes(String(value || '').trim().toLowerCase());
};

const parseConnectionHost = (connectionString: string): string | null => {
    try {
        return new URL(connectionString).hostname || null;
    } catch {
        return null;
    }
};

const isTailscaleHost = (host?: string | null): boolean => {
    if (!host) return false;
    const normalized = host.toLowerCase();
    if (normalized.endsWith('.ts.net')) return true;

    const parts = normalized.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }

    // Tailscale IPv4 addresses live in 100.64.0.0/10 and are already encrypted by WireGuard.
    return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
};

const connectionStringSslMode = (connectionString: string): string => {
    try {
        return (new URL(connectionString).searchParams.get('sslmode') || '').toLowerCase();
    } catch {
        return '';
    }
};

const getDatabaseSslConfig = (connectionString: string, isRemoteDb: boolean): DatabaseSslConfig => {
    const explicitSsl =
        process.env.DB_SSL
        || process.env.DATABASE_SSL
        || (isRemoteDb ? process.env.REMOTE_DB_SSL || process.env.REMOTE_DATABASE_SSL : '');
    const sslMode = connectionStringSslMode(connectionString);

    if (isDisabledEnvFlag(explicitSsl) || sslMode === 'disable') {
        return false;
    }

    if (isEnabledEnvFlag(explicitSsl) || ['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
        return {
            rejectUnauthorized: sslMode === 'verify-ca' || sslMode === 'verify-full',
        };
    }

    if (!isRemoteDb) {
        return false;
    }

    if (isTailscaleHost(parseConnectionHost(connectionString))) {
        return false;
    }

    // For non-Tailscale remote databases, prefer encrypted PostgreSQL transport by default.
    return { rejectUnauthorized: false };
};

const testDatabaseConnection = async (connectionString: string, isRemoteDb: boolean = true): Promise<boolean> => {
    let testPool: Pool | null = null;
    let client: PoolClient | null = null;
    try {
        testPool = new Pool({
            connectionString,
            connectionTimeoutMillis: 5000,
            ssl: getDatabaseSslConfig(connectionString, isRemoteDb),
        });
        client = await testPool.connect();
        await client.query('SELECT 1');
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        void errorMessage;
        return false;
    } finally {
        if (client) {
            await client.release();
        }
        if (testPool) {
            await testPool.end().catch(() => undefined);
        }
    }
};

const parseAddressHost = (value?: string | null): string | null => {
    if (!value) return null;

    try {
        return new URL(value).hostname || null;
    } catch {
        const normalized = String(value).trim();
        if (!normalized) return null;

        const withoutPath = normalized.split('/')[0];
        const host = withoutPath.split(':')[0];
        return host || null;
    }
};

const buildPostgresConnectionString = ({
    host,
    port,
    database,
    user,
    password,
}: {
    host: string;
    port: string;
    database: string;
    user: string;
    password: string;
}): string => {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
};

export const getLocalDatabaseConnectionString = (): string => {
    return process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || '';
};

export const getRemoteDatabaseConnectionString = (): string => {
    const explicitRemoteUrl =
        process.env.REMOTE_DATABASE_URL
        || process.env.DATABASE_URL_REMOTE
        || process.env.WINDOWS_DATABASE_URL
        || '';

    if (explicitRemoteUrl) {
        return explicitRemoteUrl;
    }

    const localUrl = getLocalDatabaseConnectionString();
    const legacyDatabaseUrl = process.env.DATABASE_URL || '';
    if (legacyDatabaseUrl && legacyDatabaseUrl !== localUrl) {
        return legacyDatabaseUrl;
    }

    const remoteHost =
        process.env.REMOTE_DB_HOST
        || process.env.REMOTE_DATABASE_HOST
        || process.env.WINDOWS_DB_HOST
        || process.env.TAILSCALE_WINDOWS_IP
        || parseAddressHost(process.env.SYMMETRIC_REGISTRATION_URL)
        || parseAddressHost(process.env.HEALTH_TARGET_ADDRESS)
        || '';

    if (!remoteHost) {
        return '';
    }

    const remotePort =
        process.env.REMOTE_DB_PORT
        || process.env.REMOTE_DATABASE_PORT
        || process.env.WINDOWS_DB_PORT
        || '5432';

    const remoteDatabase =
        process.env.REMOTE_DB_NAME
        || process.env.REMOTE_DATABASE_NAME
        || process.env.WINDOWS_DB_NAME
        || process.env.DB_NAME
        || 'Segmentica';

    const remoteUser =
        process.env.REMOTE_DB_USER
        || process.env.REMOTE_DATABASE_USER
        || process.env.WINDOWS_DB_USER
        || process.env.DB_USER
        || 'postgres';

    const remotePassword =
        process.env.REMOTE_DB_PASSWORD
        || process.env.REMOTE_DATABASE_PASSWORD
        || process.env.WINDOWS_DB_PASSWORD
        || process.env.DB_PASSWORD
        || 'postgres';

    return buildPostgresConnectionString({
        host: remoteHost,
        port: remotePort,
        database: remoteDatabase,
        user: remoteUser,
        password: remotePassword,
    });
};

export const hasRemoteDatabaseConfig = (): boolean => {
    return Boolean(getRemoteDatabaseConnectionString());
};

export const getRemoteDatabaseHost = (): string | null => {
    return parseAddressHost(getRemoteDatabaseConnectionString())
        || parseAddressHost(process.env.SYMMETRIC_REGISTRATION_URL)
        || parseAddressHost(process.env.HEALTH_TARGET_ADDRESS);
};

export const getEffectiveDbMode = (): DbMode => {
    return dbMode === 'remote' && remoteAvailable && hasRemoteDatabaseConfig()
        ? 'remote'
        : 'local';
};

type MutatingOpInfo = {
    op: 'insert' | 'update' | 'delete' | 'other';
    tableName: string | null;
};

const parseMutatingOpInfo = (sqlText: string): MutatingOpInfo => {
    const sql = String(sqlText || '').replace(/\s+/g, ' ').trim();
    const lower = sql.toLowerCase();

    const identifier = String.raw`(?:"([^"]+)"|([a-zA-Z_][\w$]*))`;
    const qualifiedIdentifier = String.raw`(?:${identifier}\s*\.\s*)?${identifier}`;

    const pickTableName = (prefix: string): string | null => {
        const m = sql.match(new RegExp(`${prefix}\\s+${qualifiedIdentifier}`, 'i'));
        if (!m) return null;

        // Capture groups are: optional schema quoted/bare, then table quoted/bare.
        return m[3] || m[4] || null;
    };

    if (lower.startsWith('update')) {
        const tableName = pickTableName('update');
        return { op: 'update', tableName };
    }
    if (lower.startsWith('delete')) {
        const tableName = pickTableName('delete\\s+from');
        return { op: 'delete', tableName };
    }
    if (lower.startsWith('insert')) {
        const tableName = pickTableName('insert\\s+into');
        return { op: 'insert', tableName };
    }
    return { op: 'other', tableName: null };
};

const inferIdFromSqlWhere = (sqlText: string, params?: any[]): string | number | null => {
    const sql = String(sqlText || '').replace(/\s+/g, ' ').trim();
    // WHERE id = $1  OR  WHERE "id" = $1
    const m = sql.match(/\bwhere\b[\s\S]*?\b"?id"?\s*=\s*\$(\d+)\b/i);
    if (m?.[1]) {
        const idx = Number(m[1]) - 1;
        if (idx >= 0 && Array.isArray(params) && idx < params.length) {
            const v = params[idx];
            const asNum = Number(v);
            return Number.isFinite(asNum) && String(v).trim() !== '' ? asNum : String(v);
        }
    }

    const m2 = sql.match(/\bwhere\b[\s\S]*?\b"?id"?\s*=\s*(\d+)\b/i);
    if (m2?.[1]) return Number(m2[1]);
    return null;
};

const diffRows = (beforeRow: any, afterRow: any): { field: string; from: any; to: any }[] => {
    const ignore = new Set(['updated_at', 'created_at', 'created', 'updated']);
    const b = beforeRow && typeof beforeRow === 'object' ? beforeRow : {};
    const a = afterRow && typeof afterRow === 'object' ? afterRow : {};

    const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
    const changes: { field: string; from: any; to: any }[] = [];
    for (const k of Array.from(keys)) {
        if (ignore.has(k)) continue;
        const from = (b as any)[k];
        const to = (a as any)[k];
        // Compare primitives and JSON-ish objects safely
        const eq = (() => {
            if (from === to) return true;
            if (from == null && to == null) return true;
            if (typeof from === 'object' || typeof to === 'object') {
                try {
                    return JSON.stringify(from) === JSON.stringify(to);
                } catch {
                    return false;
                }
            }
            return false;
        })();
        if (!eq) changes.push({ field: k, from, to });
    }
    return changes;
};

const stopConnectionCheck = () => {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    checkInterval = null;
    globalForDb.__segmenticaDbCheckInterval = null;
};

export const refreshRemoteAvailability = async (): Promise<boolean> => {
    const remoteUrl = getRemoteDatabaseConnectionString();
    const nextRemoteAvailable = remoteUrl ? await testDatabaseConnection(remoteUrl) : false;
    remoteAvailable = nextRemoteAvailable;

    const shouldUseRemote = getEffectiveDbMode() === 'remote';
    if (shouldUseRemote !== isRemote && (pool || poolPromise)) {
        await resetPool();
    }

    return nextRemoteAvailable;
};

const startConnectionCheck = (checkIntervalMs: number = 15000) => {
    stopConnectionCheck();

    const checkConnection = async () => {
        try {
            await refreshRemoteAvailability();
        } catch (error) {
            console.error('Error auto-checking remote database:', error);
        }
    };

    void checkConnection();

    checkInterval = setInterval(checkConnection, checkIntervalMs);
    globalForDb.__segmenticaDbCheckInterval = checkInterval;

    if (!globalForDb.__segmenticaDbExitHandlerRegistered) {
        process.once('exit', stopConnectionCheck);
        globalForDb.__segmenticaDbExitHandlerRegistered = true;
    }
};

const getConnectionString = async (): Promise<{ connectionString: string; isRemote: boolean }> => {
    try {
        if (getEffectiveDbMode() === 'remote') {
            return {
                connectionString: getRemoteDatabaseConnectionString(),
                isRemote: true,
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error checking remote database:', errorMessage);
    }

    isRemote = false;
    return {
        connectionString: getLocalDatabaseConnectionString(),
        isRemote: false
    };
};

let poolPromise: Promise<Pool> | null = globalForDb.__segmenticaDbPoolPromise ?? null;
let pool: Pool | null = globalForDb.__segmenticaDbPool ?? null;
let localPoolPromise: Promise<Pool> | null = globalForDb.__segmenticaLocalDbPoolPromise ?? null;
let localPool: Pool | null = globalForDb.__segmenticaLocalDbPool ?? null;
const transactionClientStorage = new AsyncLocalStorage<PoolClient>();

const createPool = async () => {
    try {
        const { connectionString, isRemote: isRemoteDb } = await getConnectionString();
        isRemote = isRemoteDb;

        return new Pool({
            connectionString,
            ssl: getDatabaseSslConfig(connectionString, isRemoteDb),
        });
    } catch (error) {
        console.error('Error creating database pool:', error);
        throw error;
    }
};

const ensurePool = async () => {
    if (pool) return pool;
    if (!poolPromise) {
        poolPromise = createPool().then((p) => {
            pool = p;
            globalForDb.__segmenticaDbPool = p;
            return p;
        });
        globalForDb.__segmenticaDbPoolPromise = poolPromise;
    }
    return poolPromise;
};

const createLocalPool = async () => {
    const connectionString = getLocalDatabaseConnectionString();
    return new Pool({
        connectionString,
        ssl: getDatabaseSslConfig(connectionString, false),
    });
};

const ensureLocalPool = async () => {
    if (localPool) return localPool;
    if (!localPoolPromise) {
        localPoolPromise = createLocalPool().then((p) => {
            localPool = p;
            globalForDb.__segmenticaLocalDbPool = p;
            return p;
        });
        globalForDb.__segmenticaLocalDbPoolPromise = localPoolPromise;
    }
    return localPoolPromise;
};

type AuditColumns = {
    cols: Set<string>;
    actorCol: string | null;
};

let auditColsCache: AuditColumns | null = null;
let loggedMissingCtx = false;
let loggedNoAuditCols = false;

const safeStr = (v: unknown, max: number): string | null => {
    if (v == null) return null;
    const s = String(v);
    return s.length > max ? s.slice(0, max) : s;
};

const getPathname = (url: string | undefined | null): string => {
    const raw = url ? String(url) : '';
    const q = raw.indexOf('?');
    return q === -1 ? raw : raw.slice(0, q);
};

const inferEntityTypeFromPath = (pathname: string): string | null => {
    // Expected forms:
    // /api/transport
    // /api/orders/123/positions
    const parts = pathname.split('/').filter(Boolean);
    const apiIdx = parts.indexOf('api');
    const seg = apiIdx >= 0 ? parts[apiIdx + 1] : parts[1];
    if (!seg) return null;
    if (seg === 'auth' || seg === 'admin') return null;
    return seg;
};

const inferEntityIdFromPath = (pathname: string): string | number | null => {
    // /api/transport/15 -> 15
    // /api/orders/123/positions -> 123
    const parts = pathname.split('/').filter(Boolean);
    const apiIdx = parts.indexOf('api');
    const typeIdx = apiIdx >= 0 ? apiIdx + 1 : 1;
    const idSeg = parts[typeIdx + 1];
    if (!idSeg) return null;
    // avoid capturing nested resources like /api/orders/create
    if (!/^\d+$/.test(idSeg)) return null;
    const asNum = Number(idSeg);
    return Number.isFinite(asNum) ? asNum : idSeg;
};

const inferEntityIdFromReq = (req: any): string | number | null => {
    const q = req?.query;
    if (!q) return null;
    const id = q.id ?? q.entity_id ?? q.order_id ?? q.purchase_id;
    if (id == null) return null;
    const v = Array.isArray(id) ? id[0] : id;
    if (v == null) return null;
    const asNum = Number(v);
    return Number.isFinite(asNum) && String(v).trim() !== '' ? asNum : String(v);
};

const normalizeIntegerEntityId = (value: string | number | null | undefined): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : null;
    }
    const trimmed = String(value).trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const asNum = Number(trimmed);
    return Number.isInteger(asNum) ? asNum : null;
};

const sanitizeParam = (v: any): any => {
    if (v == null) return v;
    if (Buffer.isBuffer(v)) return { type: 'Buffer', length: v.length };
    if (Array.isArray(v)) return v.slice(0, 50).map(sanitizeParam);
    if (typeof v === 'object') {
        if (v.type === 'Buffer' && Array.isArray(v.data)) {
            return { type: 'Buffer', length: v.data.length };
        }
        const out: any = {};
        const keys = Object.keys(v).slice(0, 20);
        for (const k of keys) out[k] = sanitizeParam(v[k]);
        return out;
    }
    if (typeof v === 'string' && v.length > 500) return v.slice(0, 500);
    return v;
};

const isMutatingSql = (sql: string): boolean => {
    const s = sql
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    if (!s) return false;
    const lower = s.toLowerCase();

    if (lower.startsWith('begin') || lower.startsWith('commit') || lower.startsWith('rollback')) return false;
    if (lower.startsWith('select')) return false;

    if (/^\s*(insert|update|delete|truncate|alter|create|drop)\b/i.test(s)) return true;
    if (/^\s*with\b/i.test(s) && /\b(insert|update|delete)\b/i.test(s)) return true;

    return false;
};

type Queryable = {
    query: (text: string, params?: any[]) => Promise<any>;
};

const loadAuditColumns = async (p: Queryable): Promise<AuditColumns> => {
    if (auditColsCache) return auditColsCache;
    try {
        const colsRes = await p.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
            []
        );
        const cols = new Set<string>((colsRes.rows || []).map((r: any) => String(r.column_name)));
        const actorCol = cols.has('actor_user_id') ? 'actor_user_id' : cols.has('user_id') ? 'user_id' : null;
        auditColsCache = { cols, actorCol };
        return auditColsCache;
    } catch {
        auditColsCache = { cols: new Set<string>(), actorCol: null };
        return auditColsCache;
    }
};

const writeSqlAudit = async (
    p: Queryable,
    sqlText: string,
    params?: any[],
    extras?: {
        before?: any | null;
        after?: any | null;
        changes?: { field: string; from: any; to: any }[] | null;
        entityId?: string | number | null;
    }
) => {
    if (/\baudit_logs\b/i.test(sqlText)) return;

    const ctx = getRequestContext();
    if (!ctx) {
        if (!loggedMissingCtx) {
            loggedMissingCtx = true;
            console.error('Audit skipped for SQL mutation: missing request context');
            console.error('SQL (head):', safeStr(sqlText, 300));
        }
        return;
    }

    const meta = await loadAuditColumns(p);
    if (meta.cols.size === 0) {
        if (!loggedNoAuditCols) {
            loggedNoAuditCols = true;
            console.error('Audit skipped for SQL mutation: audit_logs columns not available (information_schema returned empty or failed)');
        }
        return;
    }

    const cols: string[] = [];
    const vals: string[] = [];
    const qParams: any[] = [];
    const push = (col: string, value: any) => {
        cols.push(col);
        qParams.push(value);
        vals.push(`$${qParams.length}`);
    };

    if (meta.actorCol && ctx.actor?.userId) push(meta.actorCol, ctx.actor.userId);

    const pathname = getPathname(ctx.req.url);
    const action = safeStr(`${ctx.req.method || 'UNKNOWN'} ${pathname || ''}`.trim(), 200) || 'sql';
    const entityType = inferEntityTypeFromPath(pathname);
    const entityId = extras?.entityId ?? inferEntityIdFromReq(ctx.req) ?? inferEntityIdFromPath(pathname);

    if (meta.cols.has('action')) push('action', action);
    else if (meta.cols.has('event')) push('event', action);

    if (entityType) {
        if (meta.cols.has('entity_type')) push('entity_type', safeStr(entityType, 200));
        else if (meta.cols.has('entity')) push('entity', safeStr(entityType, 200));
    }

    if (entityId != null) {
        const normalizedEntityId = normalizeIntegerEntityId(entityId);
        if (normalizedEntityId != null) {
            if (meta.cols.has('entity_id')) push('entity_id', normalizedEntityId);
            else if (meta.cols.has('target_id')) push('target_id', normalizedEntityId);
        }
    }

    if (meta.cols.has('ip')) push('ip', safeStr(ctx.req.headers['x-forwarded-for'] || ctx.req.socket.remoteAddress || '', 200));
    if (meta.cols.has('user_agent')) push('user_agent', safeStr(ctx.req.headers['user-agent'] || '', 500));

    const details: any = {
        method: ctx.req.method,
        url: ctx.req.url,
        sql: safeStr(sqlText, 2000),
        params: Array.isArray(params) ? params.slice(0, 50).map(sanitizeParam) : null,
    };

    if (extras?.changes && Array.isArray(extras.changes) && extras.changes.length > 0) {
        details.changes = extras.changes.map((c) => ({ field: c.field, from: sanitizeParam(c.from), to: sanitizeParam(c.to) }));
        // Store only changed fields (avoid huge meta)
        details.before = extras.before ?? null;
        details.after = extras.after ?? null;
    }

    if (meta.cols.has('details')) push('details', details);
    else if (meta.cols.has('meta')) push('meta', details);
    else if (meta.cols.has('payload')) push('payload', details);
    else if (meta.cols.has('data')) push('data', details);

    if (meta.cols.has('success')) push('success', true);

    if (cols.length === 0) return;

    const insertSql = `INSERT INTO public.audit_logs (${cols.map((c) => `\"${c}\"`).join(', ')}) VALUES (${vals.join(', ')})`;
    try {
        await p.query(insertSql, qParams);
    } catch (e) {
        console.error('Audit log insert failed:', e);
    }
};

export const setDbMode = async (mode: DbMode) => {
    dbMode = mode;

    if (mode === 'remote') {
        await refreshRemoteAvailability();
        return;
    }

    await resetPool();
};

export const resetPool = async () => {
    if (resetPoolPromise) {
        return resetPoolPromise;
    }

    resetPoolPromise = (async () => {
        if (pool) {
            try {
                await pool.end();
            } catch (error) {
                console.error('Error closing existing DB pool:', error);
            }
        }
        pool = null;
        poolPromise = null;
        pgCryptoEnsurePromise = null;
        globalForDb.__segmenticaDbPool = null;
        globalForDb.__segmenticaDbPoolPromise = null;
        globalForDb.__segmenticaPgCryptoEnsurePromise = null;
        await ensurePool();
    })().finally(() => {
        resetPoolPromise = null;
        globalForDb.__segmenticaDbResetPromise = null;
    });

    globalForDb.__segmenticaDbResetPromise = resetPoolPromise;
    return resetPoolPromise;
};

startConnectionCheck();

const queryNoAudit = async (text: string, params?: any[]) => {
    const txClient = transactionClientStorage.getStore();
    if (txClient) {
        return txClient.query(text, params);
    }

    const p = await ensurePool();
    return p.query(text, params);
};

export const ensurePgCrypto = async (): Promise<void> => {
    if (!pgCryptoEnsurePromise) {
        pgCryptoEnsurePromise = queryNoAudit('CREATE EXTENSION IF NOT EXISTS pgcrypto')
            .then(() => undefined)
            .catch((error) => {
                pgCryptoEnsurePromise = null;
                globalForDb.__segmenticaPgCryptoEnsurePromise = null;
                throw error;
            });
        globalForDb.__segmenticaPgCryptoEnsurePromise = pgCryptoEnsurePromise;
    }

    return pgCryptoEnsurePromise;
};

export const ensureLocalPgCrypto = async (): Promise<void> => {
    const p = await ensureLocalPool();
    await p.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
};

export const getDbClient = async (): Promise<PoolClient> => {
    const p = await ensurePool();
    return p.connect();
};

const query = async (text: string, params?: any[]) => {
    const txClient = transactionClientStorage.getStore();
    const queryable: Queryable = txClient ?? await ensurePool();

    const ctx = getRequestContext();
    const shouldAudit = isMutatingSql(text) && !!ctx;

    const opInfo = shouldAudit ? parseMutatingOpInfo(text) : { op: 'other', tableName: null };
    const pathname = shouldAudit ? getPathname(ctx?.req?.url) : '';
    const entityId = shouldAudit ? inferEntityIdFromReq(ctx?.req) ?? inferEntityIdFromPath(pathname) : null;
    const whereId = shouldAudit ? inferIdFromSqlWhere(text, params) : null;
    const id = entityId ?? whereId;

    const canSnapshot = shouldAudit && (opInfo.op === 'update' || opInfo.op === 'delete') && !!opInfo.tableName && id != null;
    let beforeRow: any | null = null;
    if (canSnapshot) {
        try {
            const beforeRes = await queryable.query(`SELECT * FROM public."${opInfo.tableName}" WHERE id = $1 LIMIT 1`, [id]);
            beforeRow = beforeRes.rows?.[0] ?? null;
        } catch {
            beforeRow = null;
        }
    }

    const result = await queryable.query(text, params);

    try {
        if (isMutatingSql(text)) {
            let afterRow: any | null = null;
            let changes: { field: string; from: any; to: any }[] | null = null;
            let beforeSlim: any | null = null;
            let afterSlim: any | null = null;

            // For INSERT ... RETURNING id
            let resultingId: string | number | null = null;
            if (shouldAudit && opInfo.op === 'insert') {
                const first = (result as any)?.rows?.[0];
                if (first && (first.id != null || first.ID != null)) {
                    const v = first.id ?? first.ID;
                    const asNum = Number(v);
                    resultingId = Number.isFinite(asNum) && String(v).trim() !== '' ? asNum : String(v);
                }
            }

            if (canSnapshot && opInfo.op === 'update') {
                try {
                    const afterRes = await queryable.query(`SELECT * FROM public."${opInfo.tableName}" WHERE id = $1 LIMIT 1`, [id]);
                    afterRow = afterRes.rows?.[0] ?? null;
                } catch {
                    afterRow = null;
                }

                if (beforeRow && afterRow) {
                    const d = diffRows(beforeRow, afterRow);
                    if (d.length > 0) {
                        changes = d;
                        beforeSlim = {};
                        afterSlim = {};
                        for (const c of d) {
                            (beforeSlim as any)[c.field] = sanitizeParam(c.from);
                            (afterSlim as any)[c.field] = sanitizeParam(c.to);
                        }
                    }
                }
            }

            await writeSqlAudit(queryable, text, params, {
                before: beforeSlim,
                after: afterSlim,
                changes,
                entityId: resultingId ?? id,
            });
        }
    } catch {
    }

    return result;
};

const queryLocalNoAudit = async (text: string, params?: any[]) => {
    const p = await ensureLocalPool();
    return p.query(text, params);
};

const getPool = async () => {
    return await ensurePool();
};

const withTransaction = async <T>(
    fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
    const existingClient = transactionClientStorage.getStore();
    if (existingClient) {
        return fn(existingClient);
    }

    const p = await ensurePool();
    const client = await p.connect();
    try {
        await client.query('BEGIN');
        const result = await transactionClientStorage.run(client, () => fn(client));
        await client.query('COMMIT');
        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
        }
        throw error;
    } finally {
        client.release();
    }
};

export { query, queryNoAudit, queryLocalNoAudit, getPool, withTransaction };
export default ensurePool;
