import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Table, Text, TextField } from '@radix-ui/themes';
import styles from '../../pages/admin/AdminRbac.module.css';
import modalStyles from '../Modal.module.css';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import DeleteConfirmation from '../DeleteConfirmation';

type RoleItem = {
    id: number;
    key: string;
    name?: string | null;
    description?: string | null;
};

export function RolesAdmin({ embedded }: { embedded?: boolean }): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<RoleItem[]>([]);
    const [q, setQ] = useState('');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editing, setEditing] = useState<RoleItem | null>(null);

    const [formKey, setFormKey] = useState('');
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<RoleItem | null>(null);

    const fetchItems = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const res = await fetch('/api/admin/roles');
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            setItems(Array.isArray(json?.items) ? json.items : []);
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchItems();
    }, [fetchItems]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return items;
        return items.filter((r) => {
            return (
                String(r.id).includes(s) ||
                String(r.key || '').toLowerCase().includes(s) ||
                String(r.name || '').toLowerCase().includes(s) ||
                String(r.description || '').toLowerCase().includes(s)
            );
        });
    }, [items, q]);

    const openCreate = () => {
        setEditing(null);
        setFormKey('');
        setFormName('');
        setFormDescription('');
        setIsCreateOpen(true);
    };

    const openEdit = (r: RoleItem) => {
        setEditing(r);
        setFormKey(String(r.key || ''));
        setFormName(String(r.name || ''));
        setFormDescription(String(r.description || ''));
        setIsEditOpen(true);
    };

    const saveCreate = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: formKey, name: formName, description: formDescription }),
            });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            setIsCreateOpen(false);
            await fetchItems();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const saveEdit = async () => {
        if (!editing) return;
        try {
            setSaving(true);
            const res = await fetch('/api/admin/roles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editing.id, key: formKey, name: formName, description: formDescription }),
            });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            setIsEditOpen(false);
            setEditing(null);
            await fetchItems();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (id: number) => {
        try {
            setSaving(true);
            const res = await fetch(`/api/admin/roles?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            await fetchItems();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const openDelete = (r: RoleItem) => {
        setDeleting(r);
        setIsDeleteOpen(true);
    };

    const Form = ({ onSubmit }: { onSubmit: () => void }) => {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
                className={modalStyles.radixForm}
            >
                <div className={modalStyles.radixField}>
                    <Text as="label" size="2" weight="medium">
                        Key
                    </Text>
                    <TextField.Root value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="director" size="3" />
                </div>
                <div className={modalStyles.radixField}>
                    <Text as="label" size="2" weight="medium">
                        Название (опц.)
                    </Text>
                    <TextField.Root value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Директор" size="3" />
                </div>
                <div className={modalStyles.radixField}>
                    <Text as="label" size="2" weight="medium">
                        Описание (опц.)
                    </Text>
                    <TextField.Root value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Полный доступ" size="3" />
                </div>
                <Flex justify="end" gap="3" mt="2" className={modalStyles.radixActions}>
                    <Button
                        type="submit"
                        variant="solid"
                        color="gray"
                        highContrast
                        className={modalStyles.primaryButton}
                        disabled={saving || !formKey.trim()}
                        loading={saving}
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </Button>
                </Flex>
            </form>
        );
    };

    const content = (
        <>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Роли</h1>
                        <div className={styles.subtitle}>CRUD ролей (доступ: director)</div>
                    </div>
                    <div className={styles.actions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={() => void fetchItems()}
                            className={styles.surfaceButton}
                        >
                            Обновить
                        </Button>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            onClick={openCreate}
                            className={styles.headerActionButtonDel}
                        >
                            Добавить роль
                        </Button>
                    </div>
                </div>
                <div style={{ marginTop: 12 }}>
                    <TextField.Root value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по id/key/name…" />
                </div>
            </div>

            {error ? (
                <Box p="4">
                    <Text color="red">{error}</Text>
                </Box>
            ) : null}

            {embedded ? (
                <div className={styles.ordersTableContainer}>
                    <Table.Root variant="surface" className={styles.ordersTable}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Key</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell />
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {loading ? (
                                <Table.Row>
                                    <Table.Cell colSpan={5}>Загрузка…</Table.Cell>
                                </Table.Row>
                            ) : filtered.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={5}>Пусто</Table.Cell>
                                </Table.Row>
                            ) : (
                                filtered.map((r) => (
                                    <Table.Row key={r.id}>
                                        <Table.Cell>#{r.id}</Table.Cell>
                                        <Table.Cell>
                                            <span className={styles.mono}>{r.key}</span>
                                        </Table.Cell>
                                        <Table.Cell>{r.name || '—'}</Table.Cell>
                                        <Table.Cell>{r.description || '—'}</Table.Cell>
                                        <Table.Cell>
                                            <div className={styles.actionsCell}>
                                                <button type="button" className={styles.rowIconButton} onClick={() => openEdit(r)} aria-label="Изменить">
                                                    <FiEdit2 />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.rowIconButton} ${styles.rowIconButtonDanger}`}
                                                    onClick={() => openDelete(r)}
                                                    disabled={saving}
                                                    aria-label="Удалить"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                ))
                            )}
                        </Table.Body>
                    </Table.Root>
                </div>
            ) : (
                <div className={styles.card}>
                    <div className={styles.ordersTableContainer}>
                        <Table.Root variant="surface" className={styles.ordersTable}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Key</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell />
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {loading ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>Загрузка…</Table.Cell>
                                    </Table.Row>
                                ) : filtered.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>Пусто</Table.Cell>
                                    </Table.Row>
                                ) : (
                                    filtered.map((r) => (
                                        <Table.Row key={r.id}>
                                            <Table.Cell>#{r.id}</Table.Cell>
                                            <Table.Cell>
                                                <span className={styles.mono}>{r.key}</span>
                                            </Table.Cell>
                                            <Table.Cell>{r.name || '—'}</Table.Cell>
                                            <Table.Cell>{r.description || '—'}</Table.Cell>
                                            <Table.Cell>
                                                <div className={styles.actionsCell}>
                                                    <button type="button" className={styles.rowIconButton} onClick={() => openEdit(r)} aria-label="Изменить">
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.rowIconButton} ${styles.rowIconButtonDanger}`}
                                                        onClick={() => openDelete(r)}
                                                        disabled={saving}
                                                        aria-label="Удалить"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))
                                )}
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>
            )}

            <Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <Dialog.Content className={modalStyles.radixDialog}>
                    <Dialog.Title>Новая роль</Dialog.Title>
                    <Form onSubmit={saveCreate} />
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={isEditOpen} onOpenChange={(open) => (!open ? (setIsEditOpen(false), setEditing(null)) : setIsEditOpen(true))}>
                <Dialog.Content className={modalStyles.radixDialog}>
                    <Dialog.Title>Редактирование роли</Dialog.Title>
                    <Form onSubmit={saveEdit} />
                </Dialog.Content>
            </Dialog.Root>

            <DeleteConfirmation
                isOpen={isDeleteOpen}
                onClose={() => {
                    setIsDeleteOpen(false);
                    setDeleting(null);
                }}
                onConfirm={() => {
                    if (!deleting) return;
                    void deleteItem(deleting.id).finally(() => {
                        setIsDeleteOpen(false);
                        setDeleting(null);
                    });
                }}
                order={null}
                loading={saving}
                title="Подтверждение удаления"
                message={deleting ? `Удалить роль ${deleting.key}?` : 'Удалить роль?'}
                warning="Это действие нельзя отменить. Роль будет удалена."
                confirmText={saving ? 'Удаление...' : 'Удалить'}
                cancelText="Отмена"
                contentClassName={modalStyles.radixDialog}
                actionsClassName={modalStyles.radixActions}
            />
        </>
    );

    if (embedded) return <div>{content}</div>;

    return <div className={styles.container}>{content}</div>;
}
