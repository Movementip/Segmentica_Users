import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContextProvider, TopLevelCategory } from '../context/app.context';
import { usePageTitle } from '../context/PageTitleContext';
import styles from './Layout.module.css';
import Head from 'next/head';

interface LayoutProps {
    children: React.ReactNode;
}

const pageTitles: Record<string, string> = {
    '/': 'Дашборд',
    '/login': 'Авторизация',
    '/dashboard': 'Дашборд',
    '/orders': 'Заявки',
    '/warehouse': 'Склад',
    '/suppliers': 'Поставщики',
    '/transport': 'ТК',
    '/logistics': 'Логистика',
    '/clients': 'Контрагенты',
    '/managers': 'Сотрудники',
    '/products': 'Товары',
    '/categories': 'Категории',
    '/purchases': 'Закупки',
    '/shipments': 'Отгрузки',
    '/documents': 'Документы',
    '/missing-products': 'Недостающие товары',
    '/archive': 'Архив',
    '/reports': 'Отчеты',
    '/reports/view': 'Просмотр отчета',
    '/settings': 'Настройки',
    '/admin': 'Администрирование',
    '/admin/audit': 'Аудит-лог',
    '/admin/finance': 'Финансы',
    '/admin/users': 'Пользователи',
    '/admin/roles': 'Роли',
    '/admin/permissions': 'Разрешения',
    '/admin/role-permissions': 'Права ролей',
    '/admin/schedule-board': 'График сотрудников',
    '/admin/settings': 'Настройки системы',
    '/500': 'Ошибка 500'
};

const detailTitleByPathname: Record<string, (id: string) => string> = {
    '/orders/[id]': (id) => `Заявка ${id}`,
    '/shipments/[id]': (id) => `Отгрузка ${id}`,
    '/purchases/[id]': (id) => `Закупка ${id}`,
    '/products/[id]': (id) => `Товар ${id}`,
    '/warehouse/[id]': (id) => `Склад ${id}`,
    '/suppliers/[id]': (id) => `Поставщик ${id}`,
    '/transport/[id]': (id) => `ТК ${id}`,
    '/clients/[id]': (id) => `Контрагент ${id}`,
    '/managers/[id]': (id) => `Сотрудник ${id}`,
    '/categories/[id]': (id) => `Категория ${id}`,
};

function LayoutContent({ children }: { children: React.ReactNode }): JSX.Element {
    const router = useRouter();
    const { setPageTitle } = usePageTitle();

    useEffect(() => {
        if (!router.isReady) return;

        const path = router.pathname;
        const fromStatic = pageTitles[path];
        if (fromStatic) {
            setPageTitle(fromStatic);
            return;
        }

        const resolver = detailTitleByPathname[path];
        const rawId = router.query.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        if (resolver && typeof id === 'string' && id.trim()) {
            setPageTitle(resolver(id));
            return;
        }

        setPageTitle('Дашборд');
    }, [router.isReady, router.pathname, router.query.id, setPageTitle]);

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
