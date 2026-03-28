import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { useRouter } from 'next/router';
import { Sidebar } from '../layout/Sidebar/Sidebar';
import { Header } from '../layout/Header/Header';
import { SidebarProvider } from '../context/SidebarContext';
import { PageTitleProvider, usePageTitle } from '../context/PageTitleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

function DocumentTitle(): JSX.Element {
    const { pageTitle } = usePageTitle();
    const title = pageTitle ? `${pageTitle} | Segmentica` : 'Segmentica';

    return (
        <Head>
            <title>{title}</title>
        </Head>
    );
}

function MyApp({ Component, pageProps }: AppProps) {
    const router = useRouter();
    const isLoginPage = router.pathname === '/login';

    return (
        <AuthProvider skipInitialRefresh={isLoginPage}>
            <ThemedAppShell isLoginPage={isLoginPage}>
                <SidebarProvider>
                    <PageTitleProvider>
                        <DocumentTitle />
                        {isLoginPage ? (
                            <Component {...pageProps} />
                        ) : (
                            <div style={{ display: 'flex', height: '100vh' }}>
                                <Sidebar />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <Header />
                                    <Component {...pageProps} />
                                </div>
                            </div>
                        )}
                    </PageTitleProvider>
                </SidebarProvider>
            </ThemedAppShell>
        </AuthProvider>
    );
}

function ThemedAppShell({ isLoginPage, children }: { isLoginPage: boolean; children: React.ReactNode }): JSX.Element {
    const { user } = useAuth();
    const theme = (user?.preferences?.theme === 'dark' || user?.preferences?.theme === 'light')
        ? (user.preferences.theme as 'light' | 'dark')
        : 'light';

    return (
        <Theme appearance={theme}>
            {children}
        </Theme>
    );
}

export default MyApp;
