import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    refresh: () => Promise<void>;
    setTheme: (theme: 'light' | 'dark') => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    refresh: async () => { },
    setTheme: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({
    children,
    skipInitialRefresh,
}: {
    children: React.ReactNode;
    skipInitialRefresh?: boolean;
}): JSX.Element {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                setUser(null);
                return;
            }
            const data = (await res.json()) as AuthUser;
            setUser(data);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const setTheme = useCallback(async (theme: 'light' | 'dark') => {
        await fetch('/api/auth/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme }),
        });
        await refresh();
    }, [refresh]);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        if (skipInitialRefresh) {
            setLoading(false);
            return;
        }
        void refresh();
    }, [refresh, skipInitialRefresh]);

    const value = useMemo(() => ({ user, loading, refresh, setTheme, logout }), [user, loading, refresh, setTheme, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
