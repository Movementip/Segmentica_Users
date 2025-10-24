import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import Image from 'next/image';
import {
    FiHome, FiShoppingBag, FiPackage, FiTruck,
    FiUsers, FiUser, FiBox, FiGrid, FiShoppingCart,
    FiTruck as FiTruckIcon, FiAlertTriangle, FiArchive, FiSettings
} from 'react-icons/fi';

const menuSections = [
    {
        title: 'Основное',
        items: [
            { id: 1, name: 'Дашборд', icon: <FiHome size={18} />, route: '/' },
            { id: 14, name: 'Отчеты', icon: <FiArchive size={18} />, route: '/reports' },
        ]
    },
    {
        title: 'Продажи и заказы',
        items: [
            { id: 2, name: 'Заявки', icon: <FiShoppingBag size={18} />, route: '/orders' },
            { id: 6, name: 'Контрагенты', icon: <FiUsers size={18} />, route: '/clients' },
        ]
    },
    {
        title: 'Закупки и склад',
        items: [
            { id: 10, name: 'Закупки', icon: <FiShoppingCart size={18} />, route: '/purchases' },
            { id: 3, name: 'Склад', icon: <FiPackage size={18} />, route: '/warehouse' },
            { id: 8, name: 'Товары', icon: <FiBox size={18} />, route: '/products' },
            { id: 9, name: 'Категории', icon: <FiGrid size={18} />, route: '/categories' },
            { id: 12, name: 'Недостающие товары', icon: <FiAlertTriangle size={18} />, route: '/missing-products' },
        ]
    },
    {
        title: 'Логистика',
        items: [
            { id: 4, name: 'Поставщики', icon: <FiTruck size={18} />, route: '/suppliers' },
            { id: 5, name: 'Транспортные компании', icon: <FiTruckIcon size={18} />, route: '/transport' },
            { id: 11, name: 'Отгрузки', icon: <FiTruckIcon size={18} />, route: '/shipments' },
        ]
    },
    {
        title: 'Администрирование',
        items: [
            { id: 7, name: 'Сотрудники', icon: <FiUser size={18} />, route: '/managers' },
            { id: 13, name: 'Архив', icon: <FiArchive size={18} />, route: '/archive' },
        ]
    }
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps): JSX.Element {
    const router = useRouter();

    const handleLinkClick = () => {
        if (onClose) {
            onClose();
        }
    };

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.logoContainer}>
                <div className={styles.logo}>
                    <Image
                        src="/logo-icon.png"
                        alt="CRM Logo"
                        width={152}
                        height={82}
                    />
                </div>
            </div>
            <nav className={styles.nav}>
                {menuSections.map((section, index) => (
                    <div key={index} className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionTitle}>{section.title}</span>
                        </div>
                        <ul className={styles.menuList}>
                            {section.items.map(item => (
                                <li key={item.id} className={styles.menuItem}>
                                    <Link
                                        href={item.route}
                                        onClick={handleLinkClick}
                                        className={`${styles.menuLink} ${router.pathname === item.route ? styles.active : ''}`}
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
            </nav>
        </aside>
    );
}