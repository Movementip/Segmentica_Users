import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import React, { useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/router';
import { ThemeProvider } from '../components/theme-provider';
import { Sidebar } from '../layout/Sidebar/Sidebar';
import { Header } from '../layout/Header/Header';
import { SidebarProvider } from '../context/SidebarContext';
import { PageTitleProvider, usePageTitle } from '../context/PageTitleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

const THEME_STORAGE_KEY = 'segmentica-theme';

function DocumentTitle(): JSX.Element {
    const { pageTitle } = usePageTitle();
    const title = pageTitle;

    return (
        <Head>
            <title>{title}</title>
        </Head>
    );
}

function MyApp({ Component, pageProps }: AppProps) {
    const isLoginPage = useRouter().pathname === '/login';

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
            storageKey={THEME_STORAGE_KEY}
        >
            <AuthProvider skipInitialRefresh={isLoginPage}>
                <ThemedAppShell isLoginPage={isLoginPage}>
                    <SidebarProvider>
                        <PageTitleProvider>
                            <DocumentTitle />
                            <ProtectedLayoutGate isLoginPage={isLoginPage}>
                                <Component {...pageProps} />
                            </ProtectedLayoutGate>
                        </PageTitleProvider>
                    </SidebarProvider>
                </ThemedAppShell>
            </AuthProvider>
        </ThemeProvider>
    );
}

function ProtectedLayoutGate({
    isLoginPage,
    children,
}: {
    isLoginPage: boolean;
    children: React.ReactNode;
}): JSX.Element | null {
    const router = useRouter();
    const { user, loading } = useAuth();

    const loginTarget = useMemo(() => {
        const next = `${router.asPath || router.pathname}`;
        return `/login?next=${encodeURIComponent(next)}`;
    }, [router.asPath, router.pathname]);

    useEffect(() => {
        if (isLoginPage || loading || user) return;
        void router.replace(loginTarget);
    }, [isLoginPage, loading, user, router, loginTarget]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (loading || !user) {
        return null;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--background)' }}>
                <Header />
                {children}
            </div>
        </div>
    );
}

function ThemedAppShell({ children }: { isLoginPage: boolean; children: React.ReactNode }): JSX.Element {
    const { user } = useAuth();
    const { theme, resolvedTheme, setTheme } = useTheme();

    const savedTheme = (user?.preferences?.theme === 'dark' || user?.preferences?.theme === 'light')
        ? (user.preferences.theme as 'light' | 'dark')
        : null;

    useEffect(() => {
        if (!savedTheme) return;
        if (theme === savedTheme) return;
        setTheme(savedTheme);
    }, [savedTheme, setTheme, theme]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!savedTheme) return;
        window.localStorage.setItem(THEME_STORAGE_KEY, savedTheme);
    }, [savedTheme]);

    const appearance = theme === 'dark'
        ? 'dark'
        : theme === 'light'
            ? 'light'
            : savedTheme ?? (resolvedTheme === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        root.classList.toggle('dark', appearance === 'dark');
        root.classList.toggle('light', appearance === 'light');
        root.dataset.theme = appearance;
        root.style.colorScheme = appearance;
        body.classList.toggle('dark', appearance === 'dark');
        body.classList.toggle('light', appearance === 'light');
        body.dataset.theme = appearance;
        body.style.colorScheme = appearance;
    }, [appearance]);

    return (
        <Theme appearance={appearance}>
            {children}
        </Theme>
    );
}

export default MyApp;
