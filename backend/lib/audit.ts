import type { NextApiRequest } from 'next';
import { queryNoAudit } from './db';
import type { AuthUser } from './auth';

type AuditColumns = {
    cols: Set<string>;
    createdAtCol: string | null;
    actorCol: string | null;
};

let cache: AuditColumns | null = null;

const loadColumns = async (): Promise<AuditColumns> => {
    if (cache != null) return cache;

    const colsRes = await queryNoAudit(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
        []
    );

    const cols = new Set<string>((colsRes.rows || []).map((r: any) => String(r.column_name)));
    const actorCol = cols.has('actor_user_id') ? 'actor_user_id' : cols.has('user_id') ? 'user_id' : null;
    const createdAtCol = cols.has('created_at') ? 'created_at' : cols.has('created') ? 'created' : null;

    const computed: AuditColumns = { cols, actorCol, createdAtCol };
    cache = computed;
    return computed;
};

const safeStr = (v: unknown, max: number): string | null => {
    if (v == null) return null;
    const s = String(v);
    const trimmed = s.length > max ? s.slice(0, max) : s;
    return trimmed;
};

export type AuditWriteInput = {
    req: NextApiRequest;
    actor: AuthUser | null;
    action: string;
    entityType?: string | null;
    entityId?: number | string | null;
    details?: unknown;
    success?: boolean;
    error?: unknown;
};

export const writeAuditLog = async (input: AuditWriteInput): Promise<void> => {
    const meta = await loadColumns();

    const ip = safeStr(input.req.headers['x-forwarded-for'] || input.req.socket.remoteAddress || '', 200);
    const userAgent = safeStr(input.req.headers['user-agent'] || '', 500);

    const cols: string[] = [];
    const vals: string[] = [];
    const params: any[] = [];

    const push = (col: string, value: any) => {
        cols.push(col);
        params.push(value);
        vals.push(`$${params.length}`);
    };

    if (meta.actorCol && input.actor?.userId) push(meta.actorCol, input.actor.userId);

    if (meta.cols.has('action')) push('action', safeStr(input.action, 200));
    else if (meta.cols.has('event')) push('event', safeStr(input.action, 200));

    const entityType = input.entityType == null ? null : safeStr(input.entityType, 200);
    const entityId = input.entityId == null ? null : safeStr(input.entityId, 200);

    if (meta.cols.has('entity_type') && entityType) push('entity_type', entityType);
    else if (meta.cols.has('entity') && entityType) push('entity', entityType);

    if (meta.cols.has('entity_id') && entityId) push('entity_id', entityId);
    else if (meta.cols.has('target_id') && entityId) push('target_id', entityId);

    if (meta.cols.has('ip') && ip) push('ip', ip);
    if (meta.cols.has('user_agent') && userAgent) push('user_agent', userAgent);

    if (meta.cols.has('success')) push('success', input.success ?? true);

    if (meta.cols.has('error') && input.error) push('error', safeStr((input.error as any)?.message || input.error, 1000));

    if (meta.cols.has('details')) push('details', input.details == null ? null : input.details);
    else if (meta.cols.has('meta')) push('meta', input.details == null ? null : input.details);
    else if (meta.cols.has('payload')) push('payload', input.details == null ? null : input.details);
    else if (meta.cols.has('data')) push('data', input.details == null ? null : input.details);

    if (cols.length === 0) return;

    const sql = `INSERT INTO public.audit_logs (${cols.map((c) => `\"${c}\"`).join(', ')}) VALUES (${vals.join(', ')})`;

    await queryNoAudit(sql, params);
};
