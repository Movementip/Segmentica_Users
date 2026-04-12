import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import { exportToWord } from '../../utils/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import styles from './ReportView.module.css';
import { Button, Card, Flex, Select, Table, Text, TextField } from '@radix-ui/themes';
import { FiSearch } from 'react-icons/fi';
import { REPORT_EXPORT_EXCEL_PERMISSIONS, REPORT_EXPORT_WORD_PERMISSIONS, REPORT_VIEW_PERMISSIONS } from '../../lib/reportsRbac';

const ReportViewer = () => {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { name } = router.query;
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [period, setPeriod] = useState<'all' | '6m' | '3m' | '1m'>('6m');
    const [search, setSearch] = useState('');

    const reportTitle =
        typeof name === 'string'
            ? name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
            : 'Отчет';
    const viewPermissionKey = typeof name === 'string' ? REPORT_VIEW_PERMISSIONS[name] : undefined;
    const canViewReport = Boolean(viewPermissionKey && user?.permissions?.includes(viewPermissionKey));
    const canExportWord = Boolean(typeof name === 'string' && user?.permissions?.includes(REPORT_EXPORT_WORD_PERMISSIONS[name]));
    const canExportExcel = Boolean(typeof name === 'string' && user?.permissions?.includes(REPORT_EXPORT_EXCEL_PERMISSIONS[name]));

    const q = search.trim().toLowerCase();

    const dateColumnKey = useMemo(() => {
        const keys = columns;
        if (!keys.length) return null;
        const preferred = keys.find((k) => /дата|date/i.test(k)) || keys.find((k) => /_at$/i.test(k));
        return preferred || null;
    }, [columns]);

    const isWithinPeriod = useCallback(
        (raw: any) => {
            if (period === 'all') return true;
            if (!raw) return true;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return true;
            const now = new Date();
            const months = period === '6m' ? 6 : period === '3m' ? 3 : 1;
            const start = new Date(now);
            start.setMonth(start.getMonth() - months);
            return d >= start;
        },
        [period]
    );

    const filteredData = useMemo(() => {
        if (!data.length) return [];
        return data.filter((row) => {
            if (dateColumnKey && !isWithinPeriod(row[dateColumnKey])) return false;
            if (!q) return true;
            return columns.some((c) => {
                const v = row?.[c];
                if (v === null || v === undefined) return false;
                return String(v).toLowerCase().includes(q);
            });
        });
    }, [columns, data, dateColumnKey, isWithinPeriod, q]);

    useEffect(() => {
        if (!name || !canViewReport) return;

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
    }, [canViewReport, name]);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (name && !canViewReport) {
        return <NoAccessPage />;
    }

    if (loading) {
        return <PageLoader label="Загрузка отчета..." fullPage />;
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
        if (typeof value === 'string') {
            const trimmed = value.trim();

            if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const d = new Date(trimmed);
                if (!Number.isNaN(d.getTime())) {
                    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }

            if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
                const n = Number(trimmed);
                if (Number.isFinite(n)) {
                    const hasFraction = Math.abs(n % 1) > 1e-9;
                    return new Intl.NumberFormat('ru-RU', {
                        maximumFractionDigits: hasFraction ? 2 : 0,
                    }).format(n);
                }
            }
        }

        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return String(value);
            const hasFraction = Math.abs(value % 1) > 1e-9;
            return new Intl.NumberFormat('ru-RU', {
                maximumFractionDigits: hasFraction ? 2 : 0,
            }).format(value);
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const exportToExcel = () => {
        if (!filteredData.length) return;

        // Format data for Excel
        const excelData = filteredData.map(row => {
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
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>{reportTitle}</h1>
                    <p className={styles.subtitle}>Отчет из базы данных</p>
                </div>

                <Flex className={styles.actions} gap="2" wrap="wrap" align="center">
                    <Select.Root value={period} onValueChange={(v) => setPeriod(v as any)}>
                        <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                        <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                            <Select.Item value="all">Весь период</Select.Item>
                            <Select.Item value="6m">Последние 6 месяцев</Select.Item>
                            <Select.Item value="3m">Последние 3 месяца</Select.Item>
                            <Select.Item value="1m">Последний месяц</Select.Item>
                        </Select.Content>
                    </Select.Root>

                    <TextField.Root
                        className={styles.searchInput}
                        size="3"
                        radius="large"
                        variant="surface"
                        placeholder="Поиск по отчету..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    >
                        <TextField.Slot side="left">
                            <FiSearch height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>

                    <Button
                        variant="surface"
                        color="gray"
                        radius="large"
                        className={styles.surfaceButton}
                        onClick={() => {
                            const wordData = {
                                id: name as string,
                                дата_создания: new Date().toISOString(),
                                клиент_название: 'Отчет',
                                общая_сумма: 0,
                                позиции: filteredData.map((row, index) => ({
                                    id: index + 1,
                                    товар_название: Object.values(row).join(' | '),
                                    товар_артикул: '',
                                    количество: 1,
                                    цена: 0,
                                    сумма: 0,
                                    товар_единица_измерения: ''
                                })),
                                ...(filteredData[0] || {})
                            };
                            exportToWord(wordData);
                        }}
                        disabled={!canExportWord || filteredData.length === 0}
                    >
                        <FiFileText /> Word
                    </Button>

                    <Button variant="surface" color="gray" radius="large" className={styles.surfaceButton} onClick={exportToExcel} disabled={!canExportExcel || filteredData.length === 0}>
                        <FiDownload /> Excel
                    </Button>

                    <Link href="/reports" className={styles.backLink}>
                        <Button variant="surface" color="gray" radius="large" className={styles.surfaceButton}>
                            <FiArrowLeft /> Назад
                        </Button>
                    </Link>
                </Flex>
            </div>

            <Card className={styles.tableSection}>
                <div className={styles.tableWrapper}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                {columns.map((column) => (
                                    <Table.ColumnHeaderCell key={column}>
                                        {column
                                            .split('_')
                                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                            .join(' ')}
                                    </Table.ColumnHeaderCell>
                                ))}
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredData.length ? (
                                filteredData.map((row, rowIndex) => (
                                    <Table.Row key={rowIndex} className={styles.tableRow}>
                                        {columns.map((column) => {
                                            const cellValue = formatValue(row[column]);
                                            return (
                                                <Table.Cell key={`${rowIndex}-${column}`} title={cellValue}>
                                                    <div className={styles.cellContent}>{cellValue}</div>
                                                </Table.Cell>
                                            );
                                        })}
                                    </Table.Row>
                                ))
                            ) : (
                                <Table.Row>
                                    <Table.Cell colSpan={Math.max(1, columns.length)}>
                                        <Text size="2" color="gray">
                                            Нет данных для отображения
                                        </Text>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table.Root>
                </div>
            </Card>
        </div>
    );
};

export default withLayout(ReportViewer);
