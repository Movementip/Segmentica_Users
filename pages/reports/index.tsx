import React from 'react';
import { withLayout } from '../../layout';
import {
    FiFileText,
    FiDownload,
    FiCalendar,
    FiDollarSign,
    FiBox,
    FiUser,
    FiTruck,
    FiPackage,
    FiUsers,
    FiTrendingUp
} from 'react-icons/fi';
import Link from 'next/link';
import styles from '../../styles/Reports.module.css';

const ReportsPage = () => {
    const reports = [
        {
            id: 1,
            title: 'Анализ контрагентов',
            description: 'Статистика по контрагентам, категории, средний чек и активность',
            icon: <FiUsers size={24} />,
            viewName: 'анализ_клиентов',
            color: '#3B82F6'
        },
        {
            id: 2,
            title: 'Анализ недостач',
            description: 'Отчет по недостающим товарам и их влиянию на продажи',
            icon: <FiPackage size={24} />,
            viewName: 'анализ_недостач',
            color: '#EF4444'
        },
        {
            id: 3,
            title: 'Анализ поставщиков',
            description: 'Рейтинг и эффективность работы поставщиков',
            icon: <FiTruck size={24} />,
            viewName: 'анализ_поставщиков',
            color: '#10B981'
        },
        {
            id: 4,
            title: 'Движения склада',
            description: 'Подробная информация о движении товаров на складе',
            icon: <FiBox size={24} />,
            viewName: 'движения_склада_детализированные',
            color: '#8B5CF6'
        },
        {
            id: 5,
            title: 'Продажи по периодам',
            description: 'Анализ продаж в разрезе временных периодов',
            icon: <FiCalendar size={24} />,
            viewName: 'продажи_по_периодам',
            color: '#F59E0B'
        },
        {
            id: 6,
            title: 'Статистика ТК',
            description: 'Анализ работы транспортных компаний',
            icon: <FiTruck size={24} />,
            viewName: 'статистика_транспортных_компаний',
            color: '#EC4899'
        },
        {
            id: 7,
            title: 'Финансовый обзор',
            description: 'Основные финансовые показатели и метрики',
            icon: <FiDollarSign size={24} />,
            viewName: 'финансовый_обзор',
            color: '#10B981'
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Отчеты</h1>
                <p>Анализ и статистика работы компании</p>
            </header>

            <div className={styles.grid}>
                {reports.map((report) => (
                    <Link
                        href={`/reports/view?name=${encodeURIComponent(report.viewName)}`}
                        key={report.id}
                        className={styles.card}
                    >
                        <div className={styles.cardIcon} style={{ backgroundColor: `${report.color}15`, color: report.color }}>
                            {report.icon}
                        </div>
                        <h3>{report.title}</h3>
                        <p>{report.description}</p>
                        <div className={styles.cardFooter}>
                            <span>Просмотреть отчет</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default withLayout(ReportsPage);
