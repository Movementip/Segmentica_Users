import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '../components/theme-provider';
import { useThemeSync } from '../hooks/use-theme-sync';
import { createThemeInitScript, THEME_STORAGE_KEY } from '../lib/theme-runtime';
import { Sidebar } from '../layout/Sidebar/Sidebar';
import { Header } from '../layout/Header/Header';
import { SidebarProvider } from '../context/SidebarContext';
import { PageTitleProvider } from '../context/PageTitleContext';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/use-auth';
import { usePageTitle } from '../hooks/use-page-title';

const themeInitScript = createThemeInitScript(THEME_STORAGE_KEY);

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
        <>
            <Head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </Head>
            <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange
                storageKey={THEME_STORAGE_KEY}
            >
                <AuthProvider skipInitialRefresh={isLoginPage}>
                    <ThemedAppShell>
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
        </>
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

function ThemedAppShell({ children }: { children: React.ReactNode }): JSX.Element {
    useThemeSync();

    return <>{children}</>;
}

export default MyApp;
