import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import { SidebarScrollProvider, useSidebarScroll } from './SidebarScrollProvider';
import { useSidebarContext } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { getDashboardAccess } from '../../lib/dashboardRbac';
import { cn } from '../../lib/utils';
import {
    Sidebar as SidebarRoot,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuIcon,
    SidebarMenuItem,
} from '../../components/ui/sidebar';
import {
    TbAlertTriangle,
    TbArchive,
    TbBox,
    TbBuildingWarehouse,
    TbCategory,
    TbClipboardList,
    TbHome,
    TbReportAnalytics,
    TbRoute,
    TbShoppingBag,
    TbShoppingCart,
    TbTruckDelivery,
    TbUser,
    TbUsers,
} from 'react-icons/tb';
import { FiPaperclip } from 'react-icons/fi';

const menuSections = [
    {
        title: 'Основное',
        items: [
            { id: 1, name: 'Дашборд', icon: <TbHome size={16} />, route: '/dashboard' },
            { id: 14, name: 'Отчеты', icon: <TbReportAnalytics size={16} />, route: '/reports' },
        ],
    },
    {
        title: 'Продажи и заказы',
        items: [
            { id: 2, name: 'Заявки', icon: <TbShoppingBag size={16} />, route: '/orders' },
            { id: 6, name: 'Контрагенты', icon: <TbUsers size={16} />, route: '/clients' },
        ],
    },
    {
        title: 'Закупки и склад',
        items: [
            { id: 10, name: 'Закупки', icon: <TbShoppingCart size={16} />, route: '/purchases' },
            { id: 3, name: 'Склад', icon: <TbBuildingWarehouse size={16} />, route: '/warehouse' },
            { id: 8, name: 'Товары', icon: <TbBox size={16} />, route: '/products' },
            { id: 9, name: 'Категории', icon: <TbCategory size={16} />, route: '/categories' },
            { id: 12, name: 'Недостающие товары', icon: <TbAlertTriangle size={16} />, route: '/missing-products' },
        ],
    },
    {
        title: 'Логистика',
        items: [
            { id: 4, name: 'Поставщики', icon: <TbTruckDelivery size={16} />, route: '/suppliers' },
            { id: 5, name: 'ТК', icon: <TbRoute size={16} />, route: '/transport' },
            { id: 11, name: 'Отгрузки', icon: <TbClipboardList size={16} />, route: '/shipments' },
        ],
    },
    {
        title: 'Администрирование',
        items: [
            { id: 7, name: 'Сотрудники', icon: <TbUser size={16} />, route: '/managers' },
            { id: 13, name: 'Архив', icon: <TbArchive size={16} />, route: '/archive' },
            { id: 15, name: 'Документы', icon: <FiPaperclip size={16} />, route: '/documents' },
        ],
    },
];

const SidebarContent = React.memo(function SidebarContent(): JSX.Element {
    const router = useRouter();
    const { user } = useAuth();
    const { saveScrollPosition } = useSidebarScroll();
    const { closeMobileMenu } = useSidebarContext();
    const dashboardAccess = React.useMemo(() => getDashboardAccess(user?.permissions), [user?.permissions]);
    const isNavigatingRef = React.useRef(false);
    const pendingHrefRef = React.useRef<string | null>(null);

    const can = React.useCallback((key: string) => Boolean(user?.permissions?.includes(key)), [user?.permissions]);

    const isRouteActive = (route: string) => {
        const currentPath = String(router.asPath || '').split('?')[0].split('#')[0];
        if (!route) return false;
        return currentPath === route || currentPath.startsWith(`${route}/`);
    };

    const getVisibleItems = React.useCallback((items: (typeof menuSections)[number]['items']) => (
        items.filter((item) => {
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
            if (item.route === '/documents') return can('documents.view');
            if (item.route === '/reports') {
                return (
                    can('reports.overview.view') ||
                    can('reports.sales.view') ||
                    can('reports.products.view') ||
                    can('reports.clients.view') ||
                    can('reports.logistics.view') ||
                    can('reports.custom.view')
                );
            }
            if (item.route === '/archive') {
                return (
                    can('archive.orders.list') ||
                    can('archive.purchases.list') ||
                    can('archive.shipments.list') ||
                    can('archive.payments.list') ||
                    can('archive.finance.list')
                );
            }

            return true;
        })
    ), [can, dashboardAccess.canDashboard]);

    const performLatestNavigation = React.useCallback(async () => {
        if (isNavigatingRef.current) return;

        isNavigatingRef.current = true;

        try {
            while (pendingHrefRef.current) {
                const nextHref = pendingHrefRef.current;
                pendingHrefRef.current = null;

                const currentPath = String(router.asPath || '').split('?')[0].split('#')[0];
                if (!nextHref || currentPath === nextHref || router.pathname === nextHref) {
                    continue;
                }

                try {
                    await router.push(nextHref);
                } catch (error) {
                    if (!(error as { cancelled?: boolean } | null)?.cancelled) {
                        console.error('Sidebar navigation error:', error);
                    }
                }
            }
        } finally {
            isNavigatingRef.current = false;
            if (pendingHrefRef.current) {
                void performLatestNavigation();
            }
        }
    }, [router]);

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (
            e.defaultPrevented ||
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
        ) {
            return;
        }

        e.preventDefault();

        saveScrollPosition();
        closeMobileMenu();

        pendingHrefRef.current = href;
        void performLatestNavigation();
    };

    return (
        <>
            <SidebarHeader>
                <a
                    href="/dashboard"
                    onClick={(e) => handleLinkClick(e, '/dashboard')}
                    className="flex min-h-20 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
                    aria-label="Перейти на дашборд"
                >
                    <Image
                        src="/logo-icon.png"
                        alt="Сегментика"
                        width={190}
                        height={84}
                        className={styles.logoImage}
                        priority
                    />
                </a>
            </SidebarHeader>

            <SidebarScrollProvider>
                {menuSections.map((section) => {
                    const visibleItems = getVisibleItems(section.items);

                    if (!visibleItems.length) return null;

                    return (
                        <SidebarGroup key={section.title}>
                            <SidebarGroupLabel>
                                {section.title}
                            </SidebarGroupLabel>
                            <SidebarMenu>
                                {visibleItems.map((item) => {
                                    const active = isRouteActive(item.route);

                                    return (
                                        <SidebarMenuItem key={item.id}>
                                            <SidebarMenuButton
                                                href={item.route}
                                                onClick={(e) => handleLinkClick(e, item.route)}
                                                isActive={active}
                                            >
                                                <SidebarMenuIcon>
                                                    {item.icon}
                                                </SidebarMenuIcon>
                                                <span className="min-w-0 flex-1 truncate">
                                                    {item.name}
                                                </span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroup>
                    );
                })}
            </SidebarScrollProvider>
        </>
    );
});

export const Sidebar = React.memo(function Sidebar(): JSX.Element {
    const { isMobileMenuOpen } = useSidebarContext();

    return (
        <SidebarRoot className={cn(styles.sidebar, isMobileMenuOpen && styles.open)}>
            <SidebarContent />
        </SidebarRoot>
    );
});
