import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContextProvider, TopLevelCategory } from '../context/app.context';
import { usePageTitle } from '../hooks/use-page-title';
import { resolvePageTitle } from '../lib/pageTitles';
import styles from './Layout.module.css';

interface LayoutProps {
    children: React.ReactNode;
}

function LayoutContent({ children }: { children: React.ReactNode }): JSX.Element {
    const router = useRouter();
    const { setPageTitle } = usePageTitle();

    useEffect(() => {
        if (!router.isReady) return;

        const rawId = router.query.id;
        setPageTitle(resolvePageTitle(router.pathname, rawId, router.asPath));
    }, [router.asPath, router.isReady, router.pathname, router.query.id, setPageTitle]);

    return <main className={styles.content}>{children}</main>;
}

export function Layout({ children }: LayoutProps): JSX.Element {
    return (
        <AppContextProvider menu={[]} firstCategory={TopLevelCategory.Dashboard}>
            <LayoutContent>{children}</LayoutContent>
        </AppContextProvider>
    );
}

import type { NextPage } from 'next';

export function withLayout<T extends Record<string, unknown> = Record<string, unknown>>(
    Component: NextPage<T> | React.ComponentType<T>
) {
    return function WithLayoutComponent(props: T): JSX.Element {
        return <Layout><Component {...props} /></Layout>;
    };
}
