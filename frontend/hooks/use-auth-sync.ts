import { useEffect } from 'react';

import { AUTH_SYNC_STORAGE_KEY, parseAuthSyncEvent } from '../lib/auth-sync';

export const isPublicAuthPath = (path: string) => {
    return path === '/login';
};

export const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    if (isPublicAuthPath(window.location.pathname)) return;

    const next = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
    const target = `/login?next=${encodeURIComponent(next)}`;
    window.location.replace(target);
};

export const redirectAuthenticatedLogin = () => {
    if (typeof window === 'undefined') return;
    if (!isPublicAuthPath(window.location.pathname)) return;

    const url = new URL(window.location.href);
    const nextParam = url.searchParams.get('next');
    const target = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/login')
        ? nextParam
        : '/';

    window.location.replace(target);
};

type UseAuthSyncOptions = {
    skipInitialRefresh?: boolean;
    refresh: (options?: { silent?: boolean }) => Promise<void>;
    onUnauthorized: (options?: { broadcast?: boolean }) => void;
};

export const useAuthSync = ({
    skipInitialRefresh,
    refresh,
    onUnauthorized,
}: UseAuthSyncOptions): void => {
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
                    onUnauthorized();
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
    }, [onUnauthorized]);

    useEffect(() => {
        if (skipInitialRefresh) return;

        const intervalId = window.setInterval(() => {
            void refresh({ silent: true });
        }, 5 * 60 * 1000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refresh({ silent: true });
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [refresh, skipInitialRefresh]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onStorage = (event: StorageEvent) => {
            if (event.key !== AUTH_SYNC_STORAGE_KEY) return;
            const authEvent = parseAuthSyncEvent(event.newValue);
            if (!authEvent) return;

            if (authEvent === 'logout') {
                onUnauthorized({ broadcast: false });
                return;
            }

            void refresh({ silent: true });
        };

        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('storage', onStorage);
        };
    }, [onUnauthorized, refresh]);
};
