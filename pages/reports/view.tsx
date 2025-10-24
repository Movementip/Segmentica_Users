import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import { exportToWord } from '../../utils/exportUtils';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import styles from '../../styles/ReportView.module.css';

const ReportViewer = () => {
    const router = useRouter();
    const { name } = router.query;
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (!name) return;

        const fetchReportData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/reports/${name}`);
                if (!response.ok) {
                    throw new Error('Не удалось загрузить данные отчета');
                }
                const result = await response.json();

                if (result.data && result.data.length > 0) {
                    setData(result.data);
                    setColumns(Object.keys(result.data[0]));
                }
                setLoading(false);
            } catch (err: any) {
                setError(err?.message || 'Произошла ошибка при загрузке отчета');
                setLoading(false);
            }
        };

        fetchReportData();
    }, [name]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Загрузка отчета...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>{error}</div>
                <Link href="/reports" className={styles.backLink}>
                    <FiArrowLeft /> Вернуться к списку отчетов
                </Link>
            </div>
        );
    }

    const formatValue = (value: any) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const exportToExcel = () => {
        if (!data.length) return;

        // Format data for Excel
        const excelData = data.map(row => {
            const formattedRow: any = {};
            columns.forEach(column => {
                formattedRow[column] = formatValue(row[column]);
            });
            return formattedRow;
        });

        // Create worksheet and workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет');

        // Generate Excel file
        const reportName = typeof name === 'string' ? name : 'report';
        XLSX.writeFile(workbook, `${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        {typeof name === 'string' ? 
                            name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                            'Отчет'}
                    </h1>
                </div>
                <div className={styles.actions}>
                    <button 
                        className={styles.button}
                        onClick={() => {
                            // Format data for Word export
                            const wordData = {
                                id: name as string,
                                дата_создания: new Date().toISOString(),
                                клиент_название: 'Отчет',
                                общая_сумма: 0,
                                позиции: data.map((row, index) => ({
                                    id: index + 1,
                                    товар_название: Object.values(row).join(' | '),
                                    товар_артикул: '',
                                    количество: 1,
                                    цена: 0,
                                    сумма: 0,
                                    товар_единица_измерения: ''
                                })),
                                ...data[0] || {}
                            };
                            exportToWord(wordData);
                        }}
                        disabled={data.length === 0}
                        aria-label="Экспорт в Word"
                        title="Экспортировать в Word"
                    >
                        <FiFileText /> Word
                    </button>
                    <button 
                        className={styles.button}
                        onClick={exportToExcel}
                        disabled={data.length === 0}
                        aria-label="Экспорт в Excel"
                        title="Экспортировать в Excel"
                    >
                        <FiDownload /> Excel
                    </button>
                    <Link href="/reports" className={styles.backLink}>
                        <FiArrowLeft /> Назад
                    </Link>
                </div>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr className={styles.tr}>
                            {columns.map((column) => (
                                <th key={column} className={styles.th}>
                                    {column.split('_').map(word =>
                                        word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className={styles.tr}>
                                {columns.map((column) => {
                                    const cellValue = formatValue(row[column]);
                                    return (
                                        <td 
                                            key={`${rowIndex}-${column}`} 
                                            className={styles.td}
                                            title={cellValue}
                                        >
                                            <div className={styles.cellContent}>
                                                {cellValue}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr className={styles.tr}>
                                <td colSpan={columns.length} className={`${styles.td} ${styles.noData}`}>
                                    Нет данных для отображения
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default withLayout(ReportViewer);
