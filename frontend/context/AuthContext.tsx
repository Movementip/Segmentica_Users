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

const isPublicAuthPath = (path: string) => {
    return path === '/login';
};

const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    if (isPublicAuthPath(window.location.pathname)) return;
    const next = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
    const target = `/login?next=${encodeURIComponent(next)}`;
    if (window.location.pathname !== '/login') {
        window.location.replace(target);
    }
};

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
                if (res.status === 401) {
                    redirectToLogin();
                }
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
        }
    }, []);

    useEffect(() => {
        if (skipInitialRefresh) {
            setLoading(false);
            return;
        }
        void refresh();
    }, [refresh, skipInitialRefresh]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalFetch = window.fetch.bind(window);
        const wrappedFetch: typeof window.fetch = async (input, init) => {
            const response = await originalFetch(input, init);

            try {
                const requestUrl = typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;
                const normalizedUrl = requestUrl.startsWith('http')
                    ? requestUrl
                    : `${window.location.origin}${requestUrl.startsWith('/') ? requestUrl : `/${requestUrl}`}`;
                const url = new URL(normalizedUrl);
                const isSameOrigin = url.origin === window.location.origin;
                const isApiCall = url.pathname.startsWith('/api/');
                const isPublicApi =
                    url.pathname.startsWith('/api/auth/login')
                    || url.pathname.startsWith('/api/auth/logout')
                    || url.pathname.startsWith('/api/employees/search');

                if (response.status === 401 && isSameOrigin && isApiCall && !isPublicApi) {
                    setUser(null);
                    redirectToLogin();
                }
            } catch {
                // ignore URL parse errors
            }

            return response;
        };

        window.fetch = wrappedFetch;

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        if (skipInitialRefresh) return;

        const intervalId = window.setInterval(() => {
            void refresh();
        }, 5 * 60 * 1000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refresh();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [refresh, skipInitialRefresh]);

    const value = useMemo(() => ({ user, loading, refresh, setTheme, logout }), [user, loading, refresh, setTheme, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
