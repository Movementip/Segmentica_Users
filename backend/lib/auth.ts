import type { NextApiRequest, NextApiResponse } from 'next';
import { queryLocalNoAudit } from './db';
import { enterRequestContext, setRequestActor } from './requestContext';

export type AuthEmployee = {
    id: number;
    fio: string;
    position: string | null;
};

export type AuthUser = {
    userId: number;
    employee: AuthEmployee;
    roles: string[];
    permissions: string[];
    preferences: Record<string, unknown>;
};

export const hasRole = (user: AuthUser | null | undefined, roleKey: string): boolean => {
    if (!user) return false;
    if (!Array.isArray(user.roles)) return false;
    return user.roles.some((r) => String(r) === roleKey);
};

export const hasPermission = (user: AuthUser | null | undefined, permissionKey: string): boolean => {
    if (!user) return false;
    if (!Array.isArray(user.permissions)) return false;
    return user.permissions.some((p) => String(p) === permissionKey);
};

export const SESSION_COOKIE_NAME = 'session_id';

const isEnabledEnvFlag = (value?: string | null): boolean => {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
};

const isDisabledEnvFlag = (value?: string | null): boolean => {
    return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
};

const shouldUseSecureSessionCookie = (): boolean => {
    const explicit = process.env.AUTH_COOKIE_SECURE || process.env.SESSION_COOKIE_SECURE;
    if (isEnabledEnvFlag(explicit)) return true;
    if (isDisabledEnvFlag(explicit)) return false;

    const publicUrl = process.env.NEXTAUTH_URL || process.env.PUBLIC_APP_URL || '';
    if (publicUrl) {
        try {
            return new URL(publicUrl).protocol === 'https:';
        } catch {
            return false;
        }
    }

    return process.env.NODE_ENV === 'production';
};

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const raw = cookieHeader || '';
    if (!raw) return out;
    for (const part of raw.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (!k) continue;
        out[k] = decodeURIComponent(v);
    }
    return out;
};

export const setSessionCookie = (
    res: NextApiResponse,
    sessionId: string,
    opts?: { expiresAt?: Date | null }
) => {
    const expiresAt = opts?.expiresAt instanceof Date && Number.isFinite(opts.expiresAt.getTime())
        ? opts.expiresAt
        : null;
    const maxAge = expiresAt
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : undefined;
    const parts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
    ];
    if (shouldUseSecureSessionCookie()) parts.push('Secure');
    if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
    if (expiresAt) parts.push(`Expires=${expiresAt.toUTCString()}`);
    res.setHeader('Set-Cookie', parts.join('; '));
};

export const clearSessionCookie = (res: NextApiResponse) => {
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0',
    ];
    if (shouldUseSecureSessionCookie()) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
};

export const getSessionIdFromRequest = (req: NextApiRequest): string | null => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[SESSION_COOKIE_NAME];
    return sid ? String(sid) : null;
};

export const getAuthUserBySessionId = async (sessionId: string): Promise<AuthUser | null> => {
    const res = await queryLocalNoAudit(
        `SELECT
            s.id as session_id,
            s.expires_at,
            s.revoked_at,
            u.id as user_id,
            COALESCE(u.preferences, '{}'::jsonb) as preferences,
            e.id as employee_id,
            e."фио" as fio,
            e."должность" as position
        FROM public.sessions s
        JOIN public.users u ON u.id = s.user_id
        JOIN public."Сотрудники" e ON e.id = u.employee_id
        WHERE s.id = $1
        LIMIT 1`,
        [sessionId]
    );

    const row = res.rows?.[0] as any;
    if (!row) return null;
    if (row.revoked_at) return null;

    const exp = new Date(row.expires_at);
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return null;

    const userId = Number(row.user_id);

    const rolesRes = await queryLocalNoAudit(
        `SELECT r.key
         FROM public.user_roles ur
         JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
    );
    const roles = (rolesRes.rows || []).map((r: any) => String(r.key));

    const isDirector = roles.some((r) => String(r).trim().toLowerCase() === 'director');

    const permissions = isDirector
        ? (
            (
                await queryLocalNoAudit(
                    `SELECT p.key
                     FROM public.permissions p
                     ORDER BY p.key ASC`,
                    []
                )
            ).rows || []
        ).map((p: any) => String(p.key))
        : (
            (
                await queryLocalNoAudit(
                    `WITH role_perms AS (
                        SELECT p.key
                        FROM public.user_roles ur
                        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
                        JOIN public.permissions p ON p.id = rp.permission_id
                        WHERE ur.user_id = $1
                    ),
                    user_overrides AS (
                        SELECT p.key, up.effect
                        FROM public.user_permissions up
                        JOIN public.permissions p ON p.id = up.permission_id
                        WHERE up.user_id = $1
                    ),
                    allowed_from_roles AS (
                        SELECT DISTINCT key, 'allow'::text AS effect
                        FROM role_perms
                    ),
                    merged AS (
                        SELECT key, effect FROM allowed_from_roles
                        UNION ALL
                        SELECT key, effect FROM user_overrides
                    )
                    SELECT key
                    FROM merged
                    GROUP BY key
                    HAVING bool_or(effect = 'allow') AND NOT bool_or(effect = 'deny')`,
                    [userId]
                )
            ).rows || []
        ).map((p: any) => String(p.key));

    return {
        userId,
        employee: {
            id: Number(row.employee_id),
            fio: String(row.fio),
            position: row.position == null ? null : String(row.position),
        },
        roles,
        permissions,
        preferences: (row.preferences && typeof row.preferences === 'object') ? (row.preferences as Record<string, unknown>) : {},
    };
};

export const requireAuth = async (req: NextApiRequest, res: NextApiResponse): Promise<AuthUser | null> => {
    // Establish request context as early as possible (before any awaits)
    // so global SQL audit can reliably capture request metadata.
    enterRequestContext(req, null);

    const sid = getSessionIdFromRequest(req);
    if (!sid) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    const user = await getAuthUserBySessionId(sid);
    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    setRequestActor(user);

    return user;
};

export const requireRole = async (req: NextApiRequest, res: NextApiResponse, roleKey: string): Promise<AuthUser | null> => {
    const user = await requireAuth(req, res);
    if (!user) return null;
    if (!hasRole(user, roleKey)) {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    return user;
};

export const requireDirector = async (req: NextApiRequest, res: NextApiResponse): Promise<AuthUser | null> => {
    return requireRole(req, res, 'director');
};

export const requirePermission = async (
    req: NextApiRequest,
    res: NextApiResponse,
    permissionKey: string
): Promise<AuthUser | null> => {
    const user = await requireAuth(req, res);
    if (!user) return null;
    if (!hasPermission(user, permissionKey)) {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    return user;
};
