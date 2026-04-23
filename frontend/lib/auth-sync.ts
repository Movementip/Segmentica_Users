export type AuthSyncEventType = 'login' | 'logout';

export const AUTH_SYNC_STORAGE_KEY = 'segmentica-auth-sync';

type AuthSyncPayload = {
    type: AuthSyncEventType;
    ts: number;
    nonce: string;
};

const isAuthSyncEventType = (value: unknown): value is AuthSyncEventType => {
    return value === 'login' || value === 'logout';
};

export const emitAuthSyncEvent = (type: AuthSyncEventType): void => {
    if (typeof window === 'undefined') return;

    const payload: AuthSyncPayload = {
        type,
        ts: Date.now(),
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    try {
        window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore storage errors
    }
};

export const parseAuthSyncEvent = (raw: string | null): AuthSyncEventType | null => {
    if (!raw) return null;

    try {
        const payload = JSON.parse(raw) as Partial<AuthSyncPayload>;
        return isAuthSyncEventType(payload?.type) ? payload.type : null;
    } catch {
        return null;
    }
};
