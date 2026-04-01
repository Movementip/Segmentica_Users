import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Card, Dialog, DropdownMenu, Flex, Select, Table, Text, TextField } from '@radix-ui/themes';
import { FiDownload, FiExternalLink, FiLink2, FiMoreHorizontal, FiPaperclip, FiPlus, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import orderStyles from '../orders/Orders.module.css';
import styles from './DocumentsPage.module.css';

type AttachmentRegistryLink = {
    entity_type: string;
    entity_id: number;
    entity_label: string;
    title: string;
    subtitle: string | null;
    href: string | null;
};

type AttachmentRegistryItem = {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number | string | null;
    created_at: string;
    links: AttachmentRegistryLink[];
    is_unattached: boolean;
};

type TargetOption = {
    id: number;
    title: string;
    subtitle: string | null;
};

const normalizeSearchValue = (value: string | null | undefined) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const filterTargetOptions = (options: TargetOption[], query: string) => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return options;

    return options.filter((option) => {
        const haystack = normalizeSearchValue(`${option.title} ${option.subtitle || ''}`);
        return haystack.includes(normalizedQuery);
    });
};

const ENTITY_OPTIONS = [
    { value: 'order', label: 'Заявка' },
    { value: 'client', label: 'Контрагент' },
    { value: 'purchase', label: 'Закупка' },
    { value: 'shipment', label: 'Отгрузка' },
    { value: 'supplier', label: 'Поставщик' },
    { value: 'transport', label: 'ТК' },
    { value: 'manager', label: 'Сотрудник' },
    { value: 'product', label: 'Товар' },
] as const;

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** power);
    return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const normalizeBytes = (value: number | string | null | undefined) => {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
};

const formatMimeType = (value: string) => {
    if (!value) return 'Не указан';
    if (value.length <= 44) return value;
    const slashIndex = value.indexOf('/');
    if (slashIndex > -1 && slashIndex < value.length - 1) {
        return value.slice(slashIndex + 1);
    }
    return value;
};

const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Неизвестно';
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

function DocumentsPage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [items, setItems] = useState<AttachmentRegistryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [attachDialogOpen, setAttachDialogOpen] = useState(false);
    const [attachDocument, setAttachDocument] = useState<AttachmentRegistryItem | null>(null);
    const [entityType, setEntityType] = useState<(typeof ENTITY_OPTIONS)[number]['value']>('order');
    const [targetQuery, setTargetQuery] = useState('');
    const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
    const [targetFallbackOptions, setTargetFallbackOptions] = useState<TargetOption[]>([]);
    const [targetLoading, setTargetLoading] = useState(false);
    const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
    const [attachSaving, setAttachSaving] = useState(false);

    const canViewDocuments = Boolean(user?.permissions?.includes('documents.view'));
    const canUploadDocuments = Boolean(user?.permissions?.includes('documents.upload'));
    const canAttachDocuments = Boolean(user?.permissions?.includes('documents.attach'));
    const canDeleteDocuments = Boolean(user?.permissions?.includes('documents.delete'));

    const loadDocuments = useCallback(async (showSpinner = true) => {
        try {
            setError(null);
            if (showSpinner) setRefreshing(true);
            const response = await fetch('/api/attachments?registry=1');
            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error((data as { error?: string }).error || 'Не удалось загрузить документы');
            }

            setItems(Array.isArray(data) ? data : []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить документы');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading || !canViewDocuments) return;
        void loadDocuments();
    }, [authLoading, canViewDocuments, loadDocuments]);

    useEffect(() => {
        if (!attachDialogOpen || !attachDocument || !canAttachDocuments) return;

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            let fallbackOptions = targetFallbackOptions;

            try {
                setTargetLoading(true);
                if (fallbackOptions.length === 0) {
                    const fallbackParams = new URLSearchParams({
                        entity_type: entityType,
                        q: '',
                        limit: '200',
                    });
                    const fallbackResponse = await fetch(`/api/attachments/targets?${fallbackParams.toString()}`, {
                        signal: controller.signal,
                    });
                    const fallbackData = await fallbackResponse.json().catch(() => []);
                    if (!fallbackResponse.ok) {
                        throw new Error((fallbackData as { error?: string }).error || 'Не удалось загрузить варианты привязки');
                    }

                    fallbackOptions = Array.isArray(fallbackData) ? (fallbackData as TargetOption[]) : [];
                    setTargetFallbackOptions(fallbackOptions);
                }

                const localMatches = filterTargetOptions(fallbackOptions, targetQuery);

                if (!targetQuery.trim()) {
                    setTargetOptions(fallbackOptions);
                    setSelectedTargetId((prev) => {
                        if (!prev) return prev;
                        return fallbackOptions.some((item) => Number(item.id) === prev) ? prev : null;
                    });
                    return;
                }

                const params = new URLSearchParams({
                    entity_type: entityType,
                    q: targetQuery,
                });
                const response = await fetch(`/api/attachments/targets?${params.toString()}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => []);

                let resolvedOptions = localMatches;

                if (response.ok) {
                    const options = Array.isArray(data) ? (data as TargetOption[]) : [];
                    const merged = new Map<number, TargetOption>();

                    for (const option of localMatches) {
                        merged.set(Number(option.id), option);
                    }

                    for (const option of options) {
                        merged.set(Number(option.id), option);
                    }

                    resolvedOptions = Array.from(merged.values());
                } else {
                    console.error((data as { error?: string }).error || 'Не удалось загрузить варианты привязки');
                }

                setTargetOptions(resolvedOptions);

                setSelectedTargetId((prev) => {
                    if (!prev) return prev;
                    return resolvedOptions.some((item) => Number(item.id) === prev) ? prev : null;
                });
            } catch (loadError) {
                if ((loadError as any)?.name === 'AbortError') return;
                console.error(loadError);
                setTargetOptions(filterTargetOptions(fallbackOptions, targetQuery));
            } finally {
                setTargetLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [attachDialogOpen, attachDocument, canAttachDocuments, entityType, targetFallbackOptions, targetQuery]);

    const currentTarget = useMemo(
        () => targetOptions.find((option) => Number(option.id) === selectedTargetId) || null,
        [selectedTargetId, targetOptions]
    );

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            setError(null);
            const form = new FormData();
            form.append('file', file);

            const response = await fetch('/api/attachments', {
                method: 'POST',
                body: form,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error((data as { error?: string }).error || 'Не удалось загрузить документ');
            }

            await loadDocuments(false);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить документ');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async (item: AttachmentRegistryItem) => {
        if (!window.confirm(`Удалить документ «${item.filename}»?`)) return;

        try {
            setError(null);
            const response = await fetch(`/api/attachments/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error((data as { error?: string }).error || 'Не удалось удалить документ');
            }

            await loadDocuments(false);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить документ');
        }
    };

    const openAttachDialog = (item: AttachmentRegistryItem) => {
        setAttachDocument(item);
        setEntityType('order');
        setTargetQuery('');
        setSelectedTargetId(null);
        setTargetOptions([]);
        setTargetFallbackOptions([]);
        setAttachDialogOpen(true);
    };

    const handleAttach = async () => {
        if (!attachDocument || !selectedTargetId) return;

        try {
            setAttachSaving(true);
            setError(null);

            const response = await fetch(`/api/attachments/${encodeURIComponent(attachDocument.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entity_type: entityType,
                    entity_id: selectedTargetId,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error((data as { error?: string }).error || 'Не удалось привязать документ');
            }

            setAttachDialogOpen(false);
            setAttachDocument(null);
            await loadDocuments(false);
        } catch (attachError) {
            setError(attachError instanceof Error ? attachError.message : 'Не удалось привязать документ');
        } finally {
            setAttachSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canViewDocuments) {
        return <NoAccessPage />;
    }

    return (
        <div className={orderStyles.container}>
            <div className={orderStyles.header}>
                <div className={orderStyles.headerContent}>
                    <div className={orderStyles.headerLeft}>
                        <h1 className={orderStyles.title}>Документы</h1>
                        <p className={orderStyles.subtitle}>
                            Общий реестр файлов по системе: видно, к чему документ привязан, и можно хранить свободные документы.
                        </p>
                    </div>

                    <div className={orderStyles.headerActions}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${orderStyles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={() => void loadDocuments()}
                            loading={refreshing}
                        >
                            <FiRefreshCw />
                            Обновить
                        </Button>
                        {canUploadDocuments ? (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className={styles.hiddenInput}
                                    onChange={handleFileChange}
                                />
                                <Button
                                    className={`${orderStyles.primaryButton} ${styles.headerActionButtonDel}`}
                                    onClick={handleUploadClick}
                                    loading={uploading}
                                >
                                    <FiPlus className={styles.icon} />
                                    Загрузить документ
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {error ? (
                <div className={styles.errorState}>{error}</div>
            ) : null}

            <div className={orderStyles.card}>
                <div className={orderStyles.tableContainer}>
                    <Table.Root variant="surface" className={orderStyles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>Документ</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Размер</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Загружен</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Применение</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {items.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={6}>
                                        <div className={styles.emptyState}>
                                            <FiPaperclip />
                                            <span>Документов пока нет</span>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ) : items.map((item) => (
                                <Table.Row key={item.id} className={orderStyles.tableRow}>
                                    <Table.Cell className={orderStyles.tableCell}>
                                        <div className={styles.tableMetaCell}>
                                            <div className={styles.fileName}>{item.filename}</div>
                                            <div className={styles.fileMeta}>ID: {item.id}</div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className={orderStyles.tableCell}>
                                        <div className={styles.typeCell} title={item.mime_type || 'application/octet-stream'}>
                                            {formatMimeType(item.mime_type || 'application/octet-stream')}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className={`${orderStyles.tableCell} ${orderStyles.amountCell}`}>
                                        {formatBytes(normalizeBytes(item.size_bytes))}
                                    </Table.Cell>
                                    <Table.Cell className={orderStyles.tableCell}>
                                        <div className={orderStyles.dateCell}>{formatDateTime(item.created_at)}</div>
                                    </Table.Cell>
                                    <Table.Cell className={orderStyles.tableCell}>
                                        {item.is_unattached ? (
                                            <span className={styles.unattachedBadge}>Не прикреплён</span>
                                        ) : (
                                            <Flex direction="column" gap="2">
                                                {item.links.map((link) => (
                                                    <div key={`${item.id}-${link.entity_type}-${link.entity_id}`} className={styles.linkTarget}>
                                                        <div className={styles.linkTargetType}>{link.entity_label}</div>
                                                        {link.href ? (
                                                            <Link href={link.href} className={styles.linkTargetTitle}>
                                                                {link.title}
                                                            </Link>
                                                        ) : (
                                                            <span className={styles.linkTargetTitle}>{link.title}</span>
                                                        )}
                                                        {link.subtitle ? (
                                                            <div className={styles.linkTargetSubtitle}>{link.subtitle}</div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </Flex>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className={orderStyles.tableCell}>
                                        <div className={orderStyles.actionsCell}>
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger>
                                                    <button
                                                        type="button"
                                                        className={`${orderStyles.menuButton} ${styles.menuButton}`}
                                                        aria-label="Меню документа"
                                                        title="Действия"
                                                    >
                                                        <FiMoreHorizontal size={18} />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Content align="end" sideOffset={6}>
                                                    <DropdownMenu.Item asChild>
                                                        <a
                                                            className={styles.rowMenuItem}
                                                            href={`/api/attachments/${encodeURIComponent(item.id)}/download`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <FiDownload className={styles.rowMenuIcon} />
                                                            Скачать
                                                        </a>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item asChild>
                                                        <a
                                                            className={styles.rowMenuItem}
                                                            href={`/api/attachments/${encodeURIComponent(item.id)}/inline`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <FiExternalLink className={styles.rowMenuIcon} />
                                                            Открыть
                                                        </a>
                                                    </DropdownMenu.Item>
                                                    {canAttachDocuments ? (
                                                        <DropdownMenu.Item className={styles.rowMenuItem} onSelect={(event) => {
                                                            event.preventDefault();
                                                            openAttachDialog(item);
                                                        }}>
                                                            <FiLink2 className={styles.rowMenuIcon} />
                                                            Привязать
                                                        </DropdownMenu.Item>
                                                    ) : null}
                                                    {canDeleteDocuments ? (
                                                        <>
                                                            <DropdownMenu.Separator />
                                                            <DropdownMenu.Item
                                                                color="red"
                                                                className={styles.rowMenuItemDanger}
                                                                onSelect={(event) => {
                                                                    event.preventDefault();
                                                                    void handleDelete(item);
                                                                }}
                                                            >
                                                                <FiTrash2 className={styles.rowMenuIconDel} />
                                                                Удалить
                                                            </DropdownMenu.Item>
                                                        </>
                                                    ) : null}
                                                </DropdownMenu.Content>
                                            </DropdownMenu.Root>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Root>
                </div>
            </div>

            <Dialog.Root
                open={attachDialogOpen}
                onOpenChange={(open) => {
                    setAttachDialogOpen(open);
                    if (!open) {
                        setAttachDocument(null);
                    }
                }}
            >
                <Dialog.Content className={styles.dialogContent}>
                    <Dialog.Title className={styles.dialogTitle}>Привязать документ</Dialog.Title>
                    <Dialog.Description className={styles.dialogDescription}>
                        {attachDocument ? `Документ: ${attachDocument.filename}` : 'Выберите, к чему прикрепить файл.'}
                    </Dialog.Description>

                    <Flex direction="column" gap="4" mt="4" className={styles.dialogForm}>
                        <Box className={styles.fieldGroup}>
                            <Text as="label" size="2" weight="medium" className={styles.fieldLabel}>Тип сущности</Text>
                            <Select.Root value={entityType} onValueChange={(value) => {
                                setEntityType(value as typeof entityType);
                                setSelectedTargetId(null);
                                setTargetQuery('');
                                setTargetOptions([]);
                                setTargetFallbackOptions([]);
                            }}>
                                <Select.Trigger variant="surface" color="gray" radius="large" className={styles.fullWidthSelect} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {ENTITY_OPTIONS.map((option) => (
                                        <Select.Item key={option.value} value={option.value}>
                                            {option.label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Box>

                        <Box className={styles.fieldGroup}>
                            <Text as="label" size="2" weight="medium" className={styles.fieldLabel}>Найти объект</Text>
                            <TextField.Root
                                value={targetQuery}
                                onChange={(event) => setTargetQuery(event.target.value)}
                                placeholder="Например: #15, Ромашка, Иванов…"
                                variant="surface"
                                radius="large"
                                size="3"
                                className={styles.fullWidthInput}
                            />
                        </Box>

                        <div className={styles.resultsSection}>
                            <div className={styles.targetsBox}>
                                {targetLoading ? (
                                    <div className={styles.targetsState}>Загрузка вариантов…</div>
                                ) : targetOptions.length === 0 ? (
                                    <div className={styles.targetsState}>Подходящих объектов не найдено</div>
                                ) : (
                                    targetOptions.map((option) => (
                                        <button
                                            key={`${entityType}-${option.id}`}
                                            type="button"
                                            className={`${styles.targetOption} ${selectedTargetId === option.id ? styles.targetOptionActive : ''}`}
                                            onClick={() => setSelectedTargetId(option.id)}
                                        >
                                            <div className={styles.targetTitle}>{option.title}</div>
                                            {option.subtitle ? (
                                                <div className={styles.targetSubtitle}>{option.subtitle}</div>
                                            ) : null}
                                        </button>
                                    ))
                                )}
                            </div>

                            {currentTarget ? (
                                <Card className={styles.selectionCard}>
                                    <Text size="2" weight="medium" className={styles.selectionLabel}>Будет привязан к:</Text>
                                    <div className={styles.targetTitle}>{currentTarget.title}</div>
                                    {currentTarget.subtitle ? (
                                        <div className={styles.targetSubtitle}>{currentTarget.subtitle}</div>
                                    ) : null}
                                </Card>
                            ) : null}
                        </div>
                    </Flex>

                    <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                        <Dialog.Close>
                            <Button variant="surface" color="gray" highContrast>
                                Отмена
                            </Button>
                        </Dialog.Close>
                        <Button
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={() => void handleAttach()}
                            disabled={!selectedTargetId}
                            loading={attachSaving}
                            className={styles.primaryBlackButton}
                        >
                            <FiPlus />
                            Привязать
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(DocumentsPage);
