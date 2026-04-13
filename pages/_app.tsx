import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import React, { useEffect, useMemo } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useRouter } from 'next/router';
import { Sidebar } from '../layout/Sidebar/Sidebar';
import { Header } from '../layout/Header/Header';
import { SidebarProvider } from '../context/SidebarContext';
import { PageTitleProvider, usePageTitle } from '../context/PageTitleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

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
        <NextThemesProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
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
        </NextThemesProvider>
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
        <div style={{ display: 'flex', height: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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

    const appearance = resolvedTheme === 'dark' || theme === 'dark' || savedTheme === 'dark' ? 'dark' : 'light';

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', appearance === 'dark');
        root.classList.toggle('light', appearance === 'light');
        root.dataset.theme = appearance;
        root.style.colorScheme = appearance;
    }, [appearance]);

    return (
        <Theme appearance={appearance}>
            {children}
        </Theme>
    );
}

export default MyApp;
