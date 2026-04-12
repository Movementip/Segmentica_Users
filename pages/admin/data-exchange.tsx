import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';
import {
    Box,
    Button,
    Select,
    Text,
} from '@radix-ui/themes';
import {
    DATA_EXCHANGE_CATALOGS,
    DATA_EXCHANGE_FORMAT_OPTIONS,
    canExportCatalog,
    canImportCatalog,
    canUseAdminDataExchangePage,
    type DataExchangeCatalogGroup,
    type DataExchangeCatalogKey,
    type DataExchangeFormat,
} from '../../lib/dataExchangeConfig';
import styles from './AdminDataExchange.module.css';

const CATALOG_GROUPS: Array<{
    key: DataExchangeCatalogGroup;
    title: string;
    description: string;
}> = [
    {
        key: 'reference',
        title: 'Справочники',
        description: 'Плоские данные: номенклатура, категории, контрагенты, поставщики, ТК и сотрудники.',
    },
    {
        key: 'operations',
        title: 'Операционные данные',
        description: 'Связанные документы и учет: заявки, недостачи, закупки, отгрузки, склад и финансы.',
    },
    {
        key: 'system',
        title: 'Системные данные',
        description: 'Системные настройки и документы. Для полного бэкапа сайта обычно используйте JSON.',
    },
];

const getFilenameFromDisposition = (value: string | null) => {
    if (!value) return null;
    const match = value.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? null;
};

const getCatalogAccessLabel = (canExportItem: boolean, canImportItem: boolean) => {
    if (canExportItem && canImportItem) return 'Можно выгружать и загружать';
    if (canExportItem) return 'Доступна только выгрузка';
    if (canImportItem) return 'Доступна только загрузка';
    return 'Нет доступа к обмену данными';
};

function GroupSelectionCheckbox({
    checked,
    indeterminate,
    onChange,
    label,
}: {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
    label: string;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    return (
        <label className={styles.groupCheckboxRow}>
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className={styles.checkboxInput}
            />
            <span className={styles.groupCheckboxText}>{label}</span>
        </label>
    );
}

function AdminDataExchangePage(): JSX.Element {
    const { user, loading } = useAuth();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedCatalogs, setSelectedCatalogs] = useState<DataExchangeCatalogKey[]>([]);
    const [exportFormat, setExportFormat] = useState<DataExchangeFormat>('excel');
    const [importFormat, setImportFormat] = useState<DataExchangeFormat>('excel');
    const [isBusy, setIsBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const permissions = user?.permissions || [];
    const canPage = canUseAdminDataExchangePage(permissions);

    const exportableCatalogs = useMemo(
        () => DATA_EXCHANGE_CATALOGS.filter((catalog) => canExportCatalog(permissions, catalog.key)),
        [permissions]
    );
    const importableCatalogs = useMemo(
        () => DATA_EXCHANGE_CATALOGS.filter((catalog) => canImportCatalog(permissions, catalog.key)),
        [permissions]
    );
    const availableCatalogKeys = useMemo(
        () =>
            DATA_EXCHANGE_CATALOGS
                .filter((catalog) => canExportCatalog(permissions, catalog.key) || canImportCatalog(permissions, catalog.key))
                .map((catalog) => catalog.key),
        [permissions]
    );
    const catalogsByGroup = useMemo(
        () => CATALOG_GROUPS
            .map((group) => ({
                ...group,
                items: DATA_EXCHANGE_CATALOGS.filter((catalog) =>
                    catalog.group === group.key
                    && (canExportCatalog(permissions, catalog.key) || canImportCatalog(permissions, catalog.key))
                ),
            }))
            .filter((group) => group.items.length > 0),
        [permissions]
    );
    const canExportFullSite = exportableCatalogs.length === DATA_EXCHANGE_CATALOGS.length;
    const selectedExportCatalogKeys = useMemo(
        () => selectedCatalogs.filter((catalogKey) => exportableCatalogs.some((item) => item.key === catalogKey)),
        [selectedCatalogs, exportableCatalogs]
    );
    const selectedImportCatalogKeys = useMemo(
        () => selectedCatalogs.filter((catalogKey) => importableCatalogs.some((item) => item.key === catalogKey)),
        [selectedCatalogs, importableCatalogs]
    );
    const isFullSiteExportSelection = selectedExportCatalogKeys.length === DATA_EXCHANGE_CATALOGS.length;
    const isFullSiteImportSelection = selectedImportCatalogKeys.length === DATA_EXCHANGE_CATALOGS.length;
    const allowedExportFormats = useMemo(() => {
        if (isFullSiteExportSelection) {
            return DATA_EXCHANGE_FORMAT_OPTIONS.filter((option) => option.value === 'json');
        }
        if (selectedExportCatalogKeys.length > 1) {
            return DATA_EXCHANGE_FORMAT_OPTIONS.filter((option) => option.value !== 'csv');
        }
        return DATA_EXCHANGE_FORMAT_OPTIONS;
    }, [isFullSiteExportSelection, selectedExportCatalogKeys.length]);
    const allowedImportFormats = useMemo(() => {
        if (isFullSiteImportSelection) {
            return DATA_EXCHANGE_FORMAT_OPTIONS.filter((option) => option.value === 'json');
        }
        if (selectedImportCatalogKeys.length > 1) {
            return DATA_EXCHANGE_FORMAT_OPTIONS.filter((option) => option.value !== 'csv');
        }
        return DATA_EXCHANGE_FORMAT_OPTIONS;
    }, [isFullSiteImportSelection, selectedImportCatalogKeys.length]);
    const exportFormatDescription = useMemo(() => {
        if (selectedExportCatalogKeys.length === 0) {
            return 'Сначала выберите хотя бы один раздел.';
        }
        if (isFullSiteExportSelection) {
            return 'Для полного экспорта сайта доступен только JSON, чтобы сохранить все связи между разделами.';
        }
        if (selectedExportCatalogKeys.length > 1) {
            return 'Для нескольких разделов доступны Excel и JSON. CSV появляется только при выборе одного раздела.';
        }
        return 'Для одного раздела доступны Excel, CSV и JSON.';
    }, [isFullSiteExportSelection, selectedExportCatalogKeys.length]);
    const importFormatDescription = useMemo(() => {
        if (selectedImportCatalogKeys.length === 0) {
            return 'Сначала выберите хотя бы один раздел.';
        }
        if (isFullSiteImportSelection) {
            return 'Для полного импорта сайта доступен только JSON, чтобы корректно восстановить связи и порядок загрузки.';
        }
        if (selectedImportCatalogKeys.length > 1) {
            return 'Для нескольких разделов доступны Excel и JSON. CSV появляется только при выборе одного раздела.';
        }
        return 'Для одного раздела доступны Excel, CSV и JSON.';
    }, [isFullSiteImportSelection, selectedImportCatalogKeys.length]);

    useEffect(() => {
        setSelectedCatalogs((current) => {
            const filtered = current.filter((key) => availableCatalogKeys.includes(key));
            if (filtered.length > 0) return filtered;
            return availableCatalogKeys;
        });
    }, [availableCatalogKeys]);

    useEffect(() => {
        if (!allowedExportFormats.some((option) => option.value === exportFormat)) {
            setExportFormat(allowedExportFormats[0]?.value ?? 'json');
        }
    }, [allowedExportFormats, exportFormat]);

    useEffect(() => {
        if (!allowedImportFormats.some((option) => option.value === importFormat)) {
            setImportFormat(allowedImportFormats[0]?.value ?? 'json');
        }
    }, [allowedImportFormats, importFormat]);

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canPage) {
        return <NoAccessPage />;
    }

    const toggleCatalog = (catalogKey: DataExchangeCatalogKey) => {
        setSelectedCatalogs((current) =>
            current.includes(catalogKey)
                ? current.filter((item) => item !== catalogKey)
                : [...current, catalogKey]
        );
    };

    const selectCatalogGroup = (catalogKeys: DataExchangeCatalogKey[]) => {
        setSelectedCatalogs((current) => Array.from(new Set([...current, ...catalogKeys])));
    };

    const clearCatalogGroup = (catalogKeys: DataExchangeCatalogKey[]) => {
        setSelectedCatalogs((current) => current.filter((catalogKey) => !catalogKeys.includes(catalogKey)));
    };

    const handleExport = async (
        overrideCatalogKeys?: DataExchangeCatalogKey[],
        overrideFormat?: DataExchangeFormat
    ) => {
        const targetCatalogKeys = overrideCatalogKeys ?? selectedCatalogs;
        const targetFormat = overrideFormat ?? exportFormat;
        const exportCatalogKeys = targetCatalogKeys.filter((catalogKey) => exportableCatalogs.some((item) => item.key === catalogKey));
        if (exportCatalogKeys.length === 0) {
            alert('Выберите хотя бы один раздел.');
            return;
        }
        if (targetFormat === 'csv' && exportCatalogKeys.length > 1) {
            alert('CSV доступен только для одного раздела за раз.');
            return;
        }

        try {
            setIsBusy(true);
            setNotice(null);
            const response = await fetch(
                `/api/admin/data-exchange/export?catalogs=${encodeURIComponent(exportCatalogKeys.join(','))}&format=${encodeURIComponent(targetFormat)}`
            );
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Ошибка экспорта');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = getFilenameFromDisposition(response.headers.get('content-disposition')) || `data-exchange.${targetFormat}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setNotice('Экспорт завершен.');
        } catch (error) {
            console.error('Admin data exchange export error:', error);
            alert(error instanceof Error ? error.message : 'Ошибка экспорта');
        } finally {
            setIsBusy(false);
        }
    };

    const handleImportFile = async (file: File) => {
        const importCatalogKeys = selectedCatalogs.filter((catalogKey) => importableCatalogs.some((item) => item.key === catalogKey));
        if (importCatalogKeys.length === 0) {
            alert('Выберите хотя бы один раздел.');
            return;
        }
        if (importFormat === 'csv' && importCatalogKeys.length > 1) {
            alert('CSV доступен только для одного раздела за раз.');
            return;
        }

        try {
            setIsBusy(true);
            setNotice(null);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('catalogs', importCatalogKeys.join(','));
            formData.append('format', importFormat);

            const response = await fetch('/api/admin/data-exchange/import', {
                method: 'POST',
                body: formData,
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'Ошибка импорта');
            }

            const summaries = payload?.summaries || {};
            const lines = importCatalogKeys.map((catalogKey) => {
                const meta = DATA_EXCHANGE_CATALOGS.find((item) => item.key === catalogKey);
                const summary = summaries[catalogKey];
                if (!summary) return `${meta?.label || catalogKey}: без данных`;
                return `${meta?.label || catalogKey}: создано ${summary.created || 0}, обновлено ${summary.updated || 0}, пропущено ${summary.skipped || 0}`;
            });
            const rebuild = payload?.rebuild;
            const rebuildNote = rebuild
                ? ` Производные данные пересобраны: заявок ${rebuild.ordersProcessed || 0}, закупок ${rebuild.purchasesProcessed || 0}, отгрузок ${rebuild.shipmentsProcessed || 0}.`
                : '';
            setNotice(`Импорт завершен. ${lines.join(' | ')}.${rebuildNote}`);
        } catch (error) {
            console.error('Admin data exchange import error:', error);
            alert(error instanceof Error ? error.message : 'Ошибка импорта');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsBusy(false);
        }
    };

    return (
        <div className={styles.container}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json,application/json,text/csv"
                style={{ display: 'none' }}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void handleImportFile(file);
                }}
            />

            <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Обмен данными</h1>
                        <div className={styles.subtitle}>
                        Массовый импорт и экспорт данных сайта в Excel, CSV и JSON. Архив, дашборд и отчеты восстанавливаются через исходные данные ниже.
                        </div>
                    </div>
                <div className={styles.headerActions}>
                    <Button asChild variant="surface" color="gray" highContrast className={styles.headerSurfaceButton}>
                        <Link href="/admin">Администрирование</Link>
                    </Button>
                    <Button asChild variant="surface" color="gray" highContrast className={styles.headerSurfaceButton}>
                        <Link href="/admin/settings">Настройки системы</Link>
                    </Button>
                </div>
            </div>

            <div className={styles.grid}>
                <section className={styles.card}>
                    <div className={styles.cardContent}>
                        <div>
                            <h2 className={styles.sectionTitle}>Разделы</h2>
                            <p className={styles.sectionText}>
                                Выберите разделы, которые хотите выгрузить или загрузить.
                            </p>
                        </div>

                        <div className={styles.catalogActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.surfaceButton} ${styles.catalogActionButton}`}
                                onClick={() => setSelectedCatalogs(availableCatalogKeys)}
                            >
                                Выбрать все
                            </Button>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.surfaceButton} ${styles.catalogActionButton}`}
                                onClick={() => setSelectedCatalogs([])}
                            >
                                Очистить
                            </Button>
                        </div>

                        <div className={styles.catalogList}>
                            {catalogsByGroup.map((group) => (
                                <div key={group.key} className={styles.catalogGroup}>
                                    {(() => {
                                        const groupCatalogKeys = group.items.map((item) => item.key);
                                        const selectedInGroup = groupCatalogKeys.filter((catalogKey) => selectedCatalogs.includes(catalogKey));
                                        const allSelected = groupCatalogKeys.length > 0 && selectedInGroup.length === groupCatalogKeys.length;
                                        const partiallySelected = selectedInGroup.length > 0 && !allSelected;

                                        return (
                                            <>
                                    <div className={styles.catalogGroupHeader}>
                                        <GroupSelectionCheckbox
                                            checked={allSelected}
                                            indeterminate={partiallySelected}
                                            onChange={() => {
                                                if (allSelected) {
                                                    clearCatalogGroup(groupCatalogKeys);
                                                } else {
                                                    selectCatalogGroup(groupCatalogKeys);
                                                }
                                            }}
                                            label={group.title}
                                        />
                                        <div className={styles.catalogGroupText}>{group.description}</div>
                                    </div>
                                    <div className={styles.catalogGroupList}>
                                        {group.items.map((catalog) => {
                                            const checked = selectedCatalogs.includes(catalog.key);
                                            const canExportItem = exportableCatalogs.some((item) => item.key === catalog.key);
                                            const canImportItem = importableCatalogs.some((item) => item.key === catalog.key);
                                            const isDisabled = !canExportItem && !canImportItem;
                                            return (
                                                <label
                                                    key={catalog.key}
                                                    className={`${styles.catalogOption} ${isDisabled ? styles.catalogOptionDisabled : ''}`}
                                                >
                                                    <div className={styles.catalogOptionMain}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleCatalog(catalog.key)}
                                                            disabled={isDisabled}
                                                            className={styles.checkboxInput}
                                                        />
                                                        <div className={styles.catalogMeta}>
                                                            <span className={styles.catalogLabel}>{catalog.label}</span>
                                                            <span className={styles.catalogAccess}>
                                                                {getCatalogAccessLabel(canExportItem, canImportItem)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className={styles.sideColumn}>
                    <section className={styles.card}>
                        <div className={styles.cardContent}>
                            <div>
                                <h2 className={styles.sectionTitle}>Экспорт</h2>
                                <p className={styles.sectionText}>
                                    {exportFormatDescription}
                                </p>
                            </div>
                            <Select.Root value={exportFormat} onValueChange={(value) => setExportFormat(value as DataExchangeFormat)}>
                                <Select.Trigger className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {allowedExportFormats.map((option) => (
                                        <Select.Item key={option.value} value={option.value}>
                                            {option.label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={styles.solidButton}
                                disabled={isBusy}
                                onClick={() => {
                                    void handleExport();
                                }}
                            >
                                Экспортировать выбранное
                            </Button>
                            {canExportFullSite ? (
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.surfaceButton}
                                    disabled={isBusy}
                                    onClick={() => {
                                        setSelectedCatalogs(availableCatalogKeys);
                                        setExportFormat('json');
                                        void handleExport(availableCatalogKeys, 'json');
                                    }}
                                >
                                    Экспортировать весь сайт (JSON)
                                </Button>
                            ) : null}
                        </div>
                    </section>

                    <section className={styles.card}>
                        <div className={styles.cardContent}>
                            <div>
                                <h2 className={styles.sectionTitle}>Импорт</h2>
                                <p className={styles.sectionText}>
                                    {importFormatDescription} Для Excel можно загружать многолистовой файл. Для JSON ожидается объект по ключам разделов или массив для одного раздела.
                                </p>
                            </div>
                            <Select.Root value={importFormat} onValueChange={(value) => setImportFormat(value as DataExchangeFormat)}>
                                <Select.Trigger className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {allowedImportFormats.map((option) => (
                                        <Select.Item key={option.value} value={option.value}>
                                            {option.label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={styles.surfaceButton}
                                disabled={isBusy}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Выбрать файл и импортировать
                            </Button>
                        </div>
                    </section>

                    {notice ? (
                        <div className={styles.notice}>{notice}</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default withLayout(AdminDataExchangePage);
