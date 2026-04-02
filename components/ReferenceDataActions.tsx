import React, { useRef, useState } from 'react';
import { Button, DropdownMenu, Flex } from '@radix-ui/themes';
import { FiDownload, FiUpload } from 'react-icons/fi';
import {
    DATA_EXCHANGE_FORMAT_OPTIONS,
    canExportCatalog,
    canImportCatalog,
    type DataExchangeCatalogKey,
    type DataExchangeFormat,
} from '../lib/dataExchangeConfig';
import styles from './ReferenceDataActions.module.css';

type ReferenceDataActionsProps = {
    catalogKey: DataExchangeCatalogKey;
    permissions: string[] | undefined;
    onImported?: () => void | Promise<void>;
};

const getFilenameFromDisposition = (value: string | null) => {
    if (!value) return null;
    const match = value.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? null;
};

const formatImportSummary = (summaries: Record<string, any> | undefined, catalogKey: DataExchangeCatalogKey) => {
    const summary = summaries?.[catalogKey];
    if (!summary) return 'Импорт завершен.';
    const warnings = Array.isArray(summary.warnings) && summary.warnings.length > 0
        ? ` Предупреждения: ${summary.warnings.slice(0, 2).join(' ')}`
        : '';
    return `Импорт завершен. Создано: ${summary.created || 0}. Обновлено: ${summary.updated || 0}. Пропущено: ${summary.skipped || 0}.${warnings}`;
};

export function ReferenceDataActions({
    catalogKey,
    permissions,
    onImported,
}: ReferenceDataActionsProps): JSX.Element | null {
    const canExport = canExportCatalog(permissions, catalogKey);
    const canImport = canImportCatalog(permissions, catalogKey);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const pendingImportFormatRef = useRef<DataExchangeFormat>('excel');
    const [isBusy, setIsBusy] = useState(false);

    if (!canExport && !canImport) return null;

    const handleExport = async (format: DataExchangeFormat) => {
        try {
            setIsBusy(true);
            const response = await fetch(
                `/api/admin/data-exchange/export?catalogs=${encodeURIComponent(catalogKey)}&format=${encodeURIComponent(format)}`
            );
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Ошибка экспорта');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = getFilenameFromDisposition(response.headers.get('content-disposition')) || `${catalogKey}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Reference export error:', error);
            alert(error instanceof Error ? error.message : 'Ошибка экспорта');
        } finally {
            setIsBusy(false);
        }
    };

    const handleImportFile = async (file: File) => {
        try {
            setIsBusy(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('catalogs', catalogKey);
            formData.append('format', pendingImportFormatRef.current);

            const response = await fetch('/api/admin/data-exchange/import', {
                method: 'POST',
                body: formData,
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'Ошибка импорта');
            }

            alert(formatImportSummary(payload?.summaries, catalogKey));
            await onImported?.();
        } catch (error) {
            console.error('Reference import error:', error);
            alert(error instanceof Error ? error.message : 'Ошибка импорта');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsBusy(false);
        }
    };

    const triggerImport = (format: DataExchangeFormat) => {
        pendingImportFormatRef.current = format;
        fileInputRef.current?.click();
    };

    return (
        <>
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
            <Flex align="center" gap="2" wrap="wrap" className={styles.actions}>
                {canExport ? (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                disabled={isBusy}
                                className={styles.actionButton}
                            >
                                <FiDownload size={14} /> Экспорт
                            </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content className={styles.menuContent} color="gray" variant="solid" highContrast>
                            {DATA_EXCHANGE_FORMAT_OPTIONS.map((option) => (
                                <DropdownMenu.Item
                                    key={option.value}
                                    className={styles.menuItem}
                                    onSelect={() => {
                                        void handleExport(option.value);
                                    }}
                                >
                                    {option.label}
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                ) : null}

                {canImport ? (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                disabled={isBusy}
                                className={styles.actionButton}
                            >
                                <FiUpload size={14} /> Импорт
                            </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content className={styles.menuContent} color="gray" variant="solid" highContrast>
                            {DATA_EXCHANGE_FORMAT_OPTIONS.map((option) => (
                                <DropdownMenu.Item
                                    key={option.value}
                                    className={styles.menuItem}
                                    onSelect={() => triggerImport(option.value)}
                                >
                                    {option.label}
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                ) : null}
            </Flex>
        </>
    );
}
