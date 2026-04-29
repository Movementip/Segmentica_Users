import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { emitAuthSyncEvent } from '../lib/auth-sync';
import {
    isPublicAuthPath,
    redirectAuthenticatedLogin,
    redirectToLogin,
    useAuthSync,
} from '../hooks/use-auth-sync';
import type { AuthUser } from '../types/auth';

export type { AuthEmployee, AuthUser } from '../types/auth';

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    refresh: (options?: { silent?: boolean }) => Promise<void>;
    setTheme: (theme: 'light' | 'dark') => Promise<void>;
    logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    refresh: async () => { },
    setTheme: async () => { },
    logout: async () => { },
});

export function AuthProvider({
    children,
    skipInitialRefresh,
}: {
    children: React.ReactNode;
    skipInitialRefresh?: boolean;
}): JSX.Element {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const handleUnauthorized = useCallback((options?: { broadcast?: boolean }) => {
        setUser(null);
        setLoading(false);
        if (options?.broadcast !== false) {
            emitAuthSyncEvent('logout');
        }
        redirectToLogin();
    }, []);

    const refresh = useCallback(async (options?: { silent?: boolean }) => {
        const silent = Boolean(options?.silent);
        try {
            if (!silent) {
                setLoading(true);
            }
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                if (res.status === 401) {
                    handleUnauthorized();
                } else if (!silent) {
                    setUser(null);
                }
                return;
            }
            const data = (await res.json()) as AuthUser;
            setUser(data);
            if (isPublicAuthPath(window.location.pathname)) {
                redirectAuthenticatedLogin();
            }
        } catch {
            if (!silent) {
                setUser(null);
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [handleUnauthorized]);

    const setTheme = useCallback(async (theme: 'light' | 'dark') => {
        setUser((currentUser) => {
            if (!currentUser) return currentUser;

            return {
                ...currentUser,
                preferences: {
                    ...currentUser.preferences,
                    theme,
                },
            };
        });

        const response = await fetch('/api/auth/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme }),
        });

        if (!response.ok) {
            await refresh();
        }
    }, [refresh]);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            setUser(null);
            emitAuthSyncEvent('logout');
        }
    }, []);

    useEffect(() => {
        if (skipInitialRefresh) {
            setLoading(false);
            return;
        }
        void refresh();
    }, [refresh, skipInitialRefresh]);

    useAuthSync({
        skipInitialRefresh,
        refresh,
        onUnauthorized: handleUnauthorized,
    });

    const value = useMemo(() => ({ user, loading, refresh, setTheme, logout }), [user, loading, refresh, setTheme, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
