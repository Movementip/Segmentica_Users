import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContextProvider, TopLevelCategory } from '../context/app.context';
import { Sidebar } from './Sidebar/Sidebar';
import { Header } from './Header/Header';
import styles from './Layout.module.css';

interface LayoutProps {
    children: React.ReactNode;
}

const pageTitles: Record<string, string> = {
    '/': 'Дашборд',
    '/orders': 'Управление заявками',
    '/warehouse': 'Управление складом',
    '/suppliers': 'Управление поставщиками',
    '/transport': 'Транспортные компании',
    '/clients': 'Управление клиентами',
    '/managers': 'Управление сотрудниками',
    '/products': 'Управление товарами',
    '/categories': 'Управление категориями',
    '/purchases': 'Управление закупками',
    '/shipments': 'Управление отгрузками',
    '/missing-products': 'Недостающие товары',
    '/archive': 'Архив',
    '/settings': 'Настройки'
};

export function Layout({ children }: LayoutProps): JSX.Element {
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [pageTitle, setPageTitle] = useState('Дашборд');

    useEffect(() => {
        // Set initial page title
        const path = router.pathname;
        setPageTitle(pageTitles[path] || 'Дашборд');

        // Update page title when route changes
        const handleRouteChange = (url: string) => {
            const path = url.split('?')[0]; // Remove query params
            setPageTitle(pageTitles[path] || 'Дашборд');
        };

        router.events.on('routeChangeComplete', handleRouteChange);
        return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
        };
    }, [router]);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <AppContextProvider menu={[]} firstCategory={TopLevelCategory.Dashboard}>
            <div className={styles.wrapper}>
                <Sidebar
                    isOpen={isMobileMenuOpen}
                    onClose={closeMobileMenu}
                />
                <div className={styles.main}>
                    <Header
                        onMenuToggle={toggleMobileMenu}
                        pageTitle={pageTitle}
                    />
                    <main className={styles.content}>{children}</main>
                </div>
                {isMobileMenuOpen && (
                    <div
                        className={styles.overlay}
                        onClick={closeMobileMenu}
                    />
                )}
            </div>
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
