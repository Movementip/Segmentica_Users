import { Pool } from 'pg';

import {
    dbMode,
    getLocalDatabaseConnectionString,
    getRemoteDatabaseHost,
    hasRemoteDatabaseConfig,
    isRemote,
    refreshRemoteAvailability,
    remoteAvailable,
    type DbMode,
} from './db';

type SymmetricSyncStatus = {
    available: boolean;
    incomingPendingBatches: number;
    outgoingPendingBatches: number;
    totalPendingBatches: number;
    incomingErrorBatches: number;
    outgoingErrorBatches: number;
    totalErrorBatches: number;
    isSynchronized: boolean;
};

export type DatabaseStatusSnapshot = {
    activeMode: DbMode;
    preferredMode: DbMode;
    isRemote: boolean;
    remoteAvailable: boolean;
    remoteConfigured: boolean;
    activeLabel: string;
    activeHint: string;
    remoteHost: string | null;
    checkedAt: string;
    sync: SymmetricSyncStatus;
};

const STATUS_CACHE_TTL_MS = 10_000;

const globalForDatabaseStatus = globalThis as typeof globalThis & {
    __segmenticaDatabaseStatusCache?: {
        expiresAt: number;
        value: DatabaseStatusSnapshot | null;
        promise: Promise<DatabaseStatusSnapshot> | null;
    };
};

const cache = globalForDatabaseStatus.__segmenticaDatabaseStatusCache ?? {
    expiresAt: 0,
    value: null,
    promise: null,
};

globalForDatabaseStatus.__segmenticaDatabaseStatusCache = cache;

const getActiveMode = (): DbMode => (isRemote ? 'remote' : 'local');

const getActiveLabel = (mode: DbMode): string => {
    return mode === 'remote' ? 'Удаленная база Windows' : 'Локальная база Docker';
};

const getActiveHint = (mode: DbMode, remoteHost: string | null): string => {
    if (mode === 'remote') {
        return remoteHost ? `Хост ${remoteHost}` : 'Удаленный узел Windows';
    }

    return 'Локальный контейнер PostgreSQL';
};

const readSymmetricSyncStatus = async (): Promise<SymmetricSyncStatus> => {
    const connectionString = getLocalDatabaseConnectionString();
    if (!connectionString) {
        return {
            available: false,
            incomingPendingBatches: 0,
            outgoingPendingBatches: 0,
            totalPendingBatches: 0,
            incomingErrorBatches: 0,
            outgoingErrorBatches: 0,
            totalErrorBatches: 0,
            isSynchronized: false,
        };
    }

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000,
    });

    try {
        const tablesResult = await pool.query(`
            SELECT
                to_regclass('public.sym_outgoing_batch') IS NOT NULL AS has_outgoing,
                to_regclass('public.sym_incoming_batch') IS NOT NULL AS has_incoming,
                to_regclass('public.sym_outgoing_error') IS NOT NULL AS has_outgoing_error,
                to_regclass('public.sym_incoming_error') IS NOT NULL AS has_incoming_error
        `);

        const hasOutgoing = Boolean(tablesResult.rows[0]?.has_outgoing);
        const hasIncoming = Boolean(tablesResult.rows[0]?.has_incoming);
        const hasOutgoingError = Boolean(tablesResult.rows[0]?.has_outgoing_error);
        const hasIncomingError = Boolean(tablesResult.rows[0]?.has_incoming_error);

        if (!hasOutgoing && !hasIncoming) {
            return {
                available: false,
                incomingPendingBatches: 0,
                outgoingPendingBatches: 0,
                totalPendingBatches: 0,
                incomingErrorBatches: 0,
                outgoingErrorBatches: 0,
                totalErrorBatches: 0,
                isSynchronized: false,
            };
        }

        const [outgoingResult, incomingResult, outgoingErrorResult, incomingErrorResult] = await Promise.all([
            hasOutgoing
                ? pool.query(`
                    SELECT
                        COUNT(*) FILTER (
                            WHERE COALESCE(TRIM(status), '') NOT IN ('OK', 'IG', 'ER')
                              AND COALESCE(error_flag, 0) = 0
                        )::integer AS pending_count,
                        COUNT(*) FILTER (
                            WHERE COALESCE(TRIM(status), '') = 'ER'
                               OR COALESCE(error_flag, 0) <> 0
                        )::integer AS error_count
                    FROM public.sym_outgoing_batch
                `)
                : Promise.resolve({ rows: [{ pending_count: 0, error_count: 0 }] }),
            hasIncoming
                ? pool.query(`
                    SELECT
                        COUNT(*) FILTER (
                            WHERE COALESCE(TRIM(status), '') NOT IN ('OK', 'IG', 'ER')
                              AND COALESCE(error_flag, 0) = 0
                        )::integer AS pending_count,
                        COUNT(*) FILTER (
                            WHERE COALESCE(TRIM(status), '') = 'ER'
                               OR COALESCE(error_flag, 0) <> 0
                        )::integer AS error_count
                    FROM public.sym_incoming_batch
                `)
                : Promise.resolve({ rows: [{ pending_count: 0, error_count: 0 }] }),
            hasOutgoingError
                ? pool.query(`
                    SELECT COUNT(DISTINCT e.batch_id::text || ':' || e.node_id)::integer AS error_count
                    FROM public.sym_outgoing_error e
                    JOIN public.sym_outgoing_batch b
                      ON b.batch_id = e.batch_id
                     AND b.node_id = e.node_id
                    WHERE COALESCE(TRIM(b.status), '') = 'ER'
                       OR COALESCE(b.error_flag, 0) <> 0
                `)
                : Promise.resolve({ rows: [{ error_count: 0 }] }),
            hasIncomingError
                ? pool.query(`
                    SELECT COUNT(DISTINCT e.batch_id::text || ':' || e.node_id)::integer AS error_count
                    FROM public.sym_incoming_error e
                    JOIN public.sym_incoming_batch b
                      ON b.batch_id = e.batch_id
                     AND b.node_id = e.node_id
                    WHERE COALESCE(TRIM(b.status), '') = 'ER'
                       OR COALESCE(b.error_flag, 0) <> 0
                `)
                : Promise.resolve({ rows: [{ error_count: 0 }] }),
        ]);

        const outgoingPendingBatches = Number(outgoingResult.rows[0]?.pending_count) || 0;
        const incomingPendingBatches = Number(incomingResult.rows[0]?.pending_count) || 0;
        const totalPendingBatches = outgoingPendingBatches + incomingPendingBatches;
        const outgoingErrorBatches = Math.max(
            Number(outgoingResult.rows[0]?.error_count) || 0,
            Number(outgoingErrorResult.rows[0]?.error_count) || 0,
        );
        const incomingErrorBatches = Math.max(
            Number(incomingResult.rows[0]?.error_count) || 0,
            Number(incomingErrorResult.rows[0]?.error_count) || 0,
        );
        const totalErrorBatches = outgoingErrorBatches + incomingErrorBatches;

        return {
            available: true,
            incomingPendingBatches,
            outgoingPendingBatches,
            totalPendingBatches,
            incomingErrorBatches,
            outgoingErrorBatches,
            totalErrorBatches,
            isSynchronized: totalPendingBatches === 0 && totalErrorBatches === 0,
        };
    } catch (error) {
        console.error('Failed to read SymmetricDS batch status:', error);
        return {
            available: false,
            incomingPendingBatches: 0,
            outgoingPendingBatches: 0,
            totalPendingBatches: 0,
            incomingErrorBatches: 0,
            outgoingErrorBatches: 0,
            totalErrorBatches: 0,
            isSynchronized: false,
        };
    } finally {
        await pool.end().catch(() => undefined);
    }
};

const buildDatabaseStatusSnapshot = async (): Promise<DatabaseStatusSnapshot> => {
    if (hasRemoteDatabaseConfig()) {
        await refreshRemoteAvailability().catch(() => false);
    }

    const activeMode = getActiveMode();
    const remoteHost = getRemoteDatabaseHost();
    const sync = await readSymmetricSyncStatus();

    return {
        activeMode,
        preferredMode: dbMode,
        isRemote,
        remoteAvailable,
        remoteConfigured: hasRemoteDatabaseConfig(),
        activeLabel: getActiveLabel(activeMode),
        activeHint: getActiveHint(activeMode, remoteHost),
        remoteHost,
        checkedAt: new Date().toISOString(),
        sync,
    };
};

export const getDatabaseStatusSnapshot = async (force = false): Promise<DatabaseStatusSnapshot> => {
    const now = Date.now();

    if (!force && cache.value && cache.expiresAt > now) {
        return cache.value;
    }

    if (!force && cache.promise) {
        return cache.promise;
    }

    cache.promise = buildDatabaseStatusSnapshot()
        .then((value) => {
            cache.value = value;
            cache.expiresAt = Date.now() + STATUS_CACHE_TTL_MS;
            return value;
        })
        .finally(() => {
            cache.promise = null;
        });

    return cache.promise;
};
