import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import Image from 'next/legacy/image';
import { SidebarScrollProvider, useSidebarScroll } from './SidebarScrollProvider';
import { useSidebarContext } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { getDashboardAccess } from '../../lib/dashboardRbac';
import {
    TbHome,
    TbReportAnalytics,
    TbShoppingBag,
    TbUsers,
    TbShoppingCart,
    TbBuildingWarehouse,
    TbBox,
    TbCategory,
    TbAlertTriangle,
    TbTruckDelivery,
    TbRoute,
    TbClipboardList,
    TbUser,
    TbArchive
} from 'react-icons/tb';

const menuSections = [
    {
        title: 'Основное',
        items: [
            { id: 1, name: 'Дашборд', icon: <TbHome size={16} />, route: '/dashboard' },
            { id: 14, name: 'Отчеты', icon: <TbReportAnalytics size={16} />, route: '/reports' },
        ]
    },
    {
        title: 'Продажи и заказы',
        items: [
            { id: 2, name: 'Заявки', icon: <TbShoppingBag size={16} />, route: '/orders' },
            { id: 6, name: 'Контрагенты', icon: <TbUsers size={16} />, route: '/clients' },
        ]
    },
    {
        title: 'Закупки и склад',
        items: [
            { id: 10, name: 'Закупки', icon: <TbShoppingCart size={16} />, route: '/purchases' },
            { id: 3, name: 'Склад', icon: <TbBuildingWarehouse size={16} />, route: '/warehouse' },
            { id: 8, name: 'Товары', icon: <TbBox size={16} />, route: '/products' },
            { id: 9, name: 'Категории', icon: <TbCategory size={16} />, route: '/categories' },
            { id: 12, name: 'Недостающие товары', icon: <TbAlertTriangle size={16} />, route: '/missing-products' },
        ]
    },
    {
        title: 'Логистика',
        items: [
            { id: 4, name: 'Поставщики', icon: <TbTruckDelivery size={16} />, route: '/suppliers' },
            { id: 5, name: 'ТК', icon: <TbRoute size={16} />, route: '/transport' },
            { id: 11, name: 'Отгрузки', icon: <TbClipboardList size={16} />, route: '/shipments' },
        ]
    },
    {
        title: 'Администрирование',
        items: [
            { id: 7, name: 'Сотрудники', icon: <TbUser size={16} />, route: '/managers' },
            { id: 13, name: 'Архив', icon: <TbArchive size={16} />, route: '/archive' },
        ]
    }
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const SidebarContent = React.memo(function SidebarContent(): JSX.Element {
    const router = useRouter();
    const { user } = useAuth();
    const { saveScrollPosition } = useSidebarScroll();
    const { closeMobileMenu } = useSidebarContext();
    const dashboardAccess = React.useMemo(() => getDashboardAccess(user?.permissions), [user?.permissions]);

    const can = React.useCallback((key: string) => Boolean(user?.permissions?.includes(key)), [user?.permissions]);

    const isRouteActive = (route: string) => {
        const currentPath = String(router.asPath || '').split('?')[0].split('#')[0];
        if (!route) return false;
        return currentPath === route || currentPath.startsWith(`${route}/`);
    };

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Сохраняем позицию скролла перед переходом
        saveScrollPosition();

        // Закрываем мобильное меню если нужно
        closeMobileMenu();
    };

    return (
        <>
            <div className={styles.logoContainer}>
                <div className={styles.logo}>
                    <Image
                        src="/logo-icon.png"
                        alt="CRM Logo"
                        width={180}
                        height={110}
                        className={styles.logoImage}
                        priority
                    />
                </div>
            </div>
            <SidebarScrollProvider>
                {menuSections.map((section, index) => (
                    <div key={index} className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionTitle}>{section.title}</span>
                        </div>
                        <ul className={styles.menuList}>
                            {section.items
                                .filter((item) => {
                                    if (item.route === '/dashboard') return dashboardAccess.canDashboard;
                                    if (item.route === '/orders') return can('orders.list');
                                    if (item.route === '/clients') return can('clients.list');
                                    if (item.route === '/purchases') return can('purchases.list');
                                    if (item.route === '/shipments') return can('shipments.list');
                                    if (item.route === '/warehouse') return can('warehouse.list');
                                    if (item.route === '/products') return can('products.list');
                                    if (item.route === '/categories') return can('categories.list');
                                    if (item.route === '/suppliers') return can('suppliers.list');
                                    if (item.route === '/transport') return can('transport.list');
                                    if (item.route === '/managers') return can('managers.list');
                                    if (item.route === '/reports')
                                        return (
                                            can('reports.overview.view') ||
                                            can('reports.sales.view') ||
                                            can('reports.products.view') ||
                                            can('reports.clients.view') ||
                                            can('reports.logistics.view') ||
                                            can('reports.custom.view')
                                        );
                                    if (item.route === '/archive')
                                        return (
                                            can('archive.orders.list') ||
                                            can('archive.purchases.list') ||
                                            can('archive.shipments.list') ||
                                            can('archive.payments.list') ||
                                            can('archive.finance.list')
                                        );
                                    return true;
                                })
                                .map(item => (
                                    <li key={item.id} className={styles.menuItem}>
                                        <Link
                                            href={item.route}
                                            onClick={handleLinkClick}
                                            className={`${styles.menuLink} ${isRouteActive(item.route) ? styles.active : ''}`}
                                        >
                                            <span className={styles.menuIcon}>{item.icon}</span>
                                            <span className={styles.menuText}>{item.name}</span>
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                        {index < menuSections.length - 1 && <div className={styles.sectionDivider} />}
                    </div>
                ))}
            </SidebarScrollProvider>
        </>
    );
});

export const Sidebar = React.memo(function Sidebar(): JSX.Element {
    const { isMobileMenuOpen } = useSidebarContext();

    return (
        <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.open : ''}`}>
            <SidebarContent />
        </aside>
    );
});
