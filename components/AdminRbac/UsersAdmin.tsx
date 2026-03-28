import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Checkbox, Dialog, Flex, Select, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { Eye, EyeOff, Lock } from 'lucide-react';
import styles from '../../pages/admin/AdminRbac.module.css';
import modalStyles from '../Modal.module.css';
import { RolesAdmin } from './RolesAdmin';
import { PermissionsAdmin } from './PermissionsAdmin';
import { RolePermissionsAdmin } from './RolePermissionsAdmin';

type UserRow = {
    user_id: number;
    employee_id: number | null;
    is_active: boolean | null;
    fio: string;
    position: string | null;
};

type RoleItem = {
    id: number;
    key: string;
    name?: string | null;
    description?: string | null;
};

type UserRoleLink = {
    user_id: number;
    role_id: number;
};

type PermissionItem = {
    id: number;
    key: string;
    name?: string | null;
    description?: string | null;
};

type RolePermissionLink = {
    role_id: number;
    permission_id: number;
};

type UserPermissionLink = {
    user_id: number;
    permission_id: number;
    allowed: boolean;
};

type EmployeeCandidate = {
    id: number;
    fio: string;
    position: string | null;
};

type PermissionModuleConfig = {
    key: string;
    label: string;
};

const PERMISSION_MODULES: PermissionModuleConfig[] = [
    { key: 'dashboard', label: 'Дашборд' },
    { key: 'reports', label: 'Отчеты' },
    { key: 'orders', label: 'Заявки' },
    { key: 'clients', label: 'Контрагенты' },
    { key: 'purchases', label: 'Закупки' },
    { key: 'warehouse', label: 'Склад' },
    { key: 'products', label: 'Товары' },
    { key: 'categories', label: 'Категории' },
    { key: 'missing_products', label: 'Недостающие товары' },
    { key: 'suppliers', label: 'Поставщики' },
    { key: 'transport', label: 'ТК' },
    { key: 'shipments', label: 'Отгрузки' },
    { key: 'managers', label: 'Сотрудники' },
    { key: 'archive', label: 'Архив' },
    { key: 'admin', label: 'Администрирование' },
    { key: 'other', label: 'Прочее' },
];

const PERMISSION_MODULE_LABELS = new Map<string, string>(PERMISSION_MODULES.map((item) => [item.key, item.label]));
const PERMISSION_MODULE_ORDER = new Map<string, number>(PERMISSION_MODULES.map((item, index) => [item.key, index]));

function normalizePermissionKeyForGrouping(key: string): { groupKey: string; sortKey: string } {
    const k = String(key || '').trim();
    if (!k) return { groupKey: 'other', sortKey: '' };

    if (k.startsWith('page.')) {
        const pageKey = k.split('.')[1] || 'other';
        const mapped = pageKey === 'applications' ? 'orders' : pageKey;
        return { groupKey: mapped || 'other', sortKey: `${mapped}.page` };
    }

    const prefix = k.split('.')[0] || 'other';
    const mappedPrefix =
        prefix === 'applications'
            ? 'orders'
            : prefix === 'warehouse-products'
                ? 'warehouse'
                : prefix;

    const sortKey = k
        .replace(/^applications\./, 'orders.')
        .replace(/^warehouse-products\./, 'warehouse.');

    return { groupKey: mappedPrefix || 'other', sortKey };
}

function permActionRank(key: string): number {
    const parts = String(key || '').split('.');
    const action = parts[1] || '';
    if (action === 'page') return 5;
    if (action === 'list') return 10;
    if (action === 'view') return 20;
    if (action === 'create') return 30;
    if (action === 'edit') return 40;
    if (action === 'delete') return 50;
    if (action === 'approve') return 60;
    if (action === 'attachments') return 70;
    return 999;
}

function permKeyCompare(a: PermissionItem, b: PermissionItem): number {
    const ak = String(a.key || '');
    const bk = String(b.key || '');

    const an = normalizePermissionKeyForGrouping(ak);
    const bn = normalizePermissionKeyForGrouping(bk);

    const byPrefix = an.groupKey.localeCompare(bn.groupKey, 'ru');
    if (byPrefix !== 0) return byPrefix;

    const byAction = permActionRank(an.sortKey) - permActionRank(bn.sortKey);
    if (byAction !== 0) return byAction;

    return an.sortKey.localeCompare(bn.sortKey, 'ru');
}

const EMPTY = '__empty__';

function getPermissionModuleLabel(groupKey: string): string {
    return PERMISSION_MODULE_LABELS.get(groupKey) || groupKey || 'Прочее';
}

export function UsersAdmin({ embedded }: { embedded?: boolean }): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [users, setUsers] = useState<UserRow[]>([]);
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [userRoles, setUserRoles] = useState<UserRoleLink[]>([]);
    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermissionLink[]>([]);
    const [userPermissions, setUserPermissions] = useState<UserPermissionLink[]>([]);

    const [q, setQ] = useState('');
    const [permQ, setPermQ] = useState('');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [employeesMissingUser, setEmployeesMissingUser] = useState<EmployeeCandidate[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(EMPTY);
    const [createPassword, setCreatePassword] = useState('');
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [createdUserId, setCreatedUserId] = useState<number | null>(null);

    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [isUserOpen, setIsUserOpen] = useState(false);
    const [userTab, setUserTab] = useState<'roles' | 'permissions' | 'password'>('roles');
    const [saving, setSaving] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordRepeat, setResetPasswordRepeat] = useState('');
    const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);
    const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [showResetPasswordRepeat, setShowResetPasswordRepeat] = useState(false);

    const [isRbacOpen, setIsRbacOpen] = useState(false);
    const [rbacTab, setRbacTab] = useState<'roles' | 'permissions' | 'role-permissions'>('roles');

    const fetchAll = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const [uRes, rRes, urRes, pRes, rpRes, upRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/roles'),
                fetch('/api/admin/user-roles'),
                fetch('/api/admin/permissions'),
                fetch('/api/admin/role-permissions'),
                fetch('/api/admin/user-permissions'),
            ]);

            const uJson = (await uRes.json().catch(() => ({}))) as any;
            const rJson = (await rRes.json().catch(() => ({}))) as any;
            const urJson = (await urRes.json().catch(() => ({}))) as any;
            const pJson = (await pRes.json().catch(() => ({}))) as any;
            const rpJson = (await rpRes.json().catch(() => ({}))) as any;
            const upJson = (await upRes.json().catch(() => ({}))) as any;

            if (!uRes.ok) throw new Error(uJson?.error || 'Ошибка');
            if (!rRes.ok) throw new Error(rJson?.error || 'Ошибка');
            if (!urRes.ok) throw new Error(urJson?.error || 'Ошибка');
            if (!pRes.ok) throw new Error(pJson?.error || 'Ошибка');
            if (!rpRes.ok) throw new Error(rpJson?.error || 'Ошибка');
            if (!upRes.ok) throw new Error(upJson?.error || 'Ошибка');

            setUsers(Array.isArray(uJson?.items) ? uJson.items : []);
            setRoles(Array.isArray(rJson?.items) ? rJson.items : []);
            setUserRoles(Array.isArray(urJson?.items) ? urJson.items : []);
            setPermissions(Array.isArray(pJson?.items) ? pJson.items : []);
            setRolePermissions(Array.isArray(rpJson?.items) ? rpJson.items : []);
            setUserPermissions(Array.isArray(upJson?.items) ? upJson.items : []);
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEmployeesMissing = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/user-provision');
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            setEmployeesMissingUser(Array.isArray(json?.items) ? json.items : []);
        } catch (e) {
            setEmployeesMissingUser([]);
            setError((e as any)?.message || 'Ошибка');
        }
    }, []);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        if (!isCreateOpen) return;
        void fetchEmployeesMissing();
    }, [fetchEmployeesMissing, isCreateOpen]);

    const rolesById = useMemo(() => {
        const m = new Map<number, RoleItem>();
        for (const r of roles) m.set(Number(r.id), r);
        return m;
    }, [roles]);

    const roleKeysByUserId = useMemo(() => {
        const m = new Map<number, string[]>();
        for (const link of userRoles) {
            const uid = Number((link as any).user_id);
            const rid = Number((link as any).role_id);
            const role = rolesById.get(rid);
            if (!role) continue;
            const arr = m.get(uid) || [];
            arr.push(String(role.key));
            m.set(uid, arr);
        }
        m.forEach((v, k) => {
            m.set(k, v.sort((a, b) => a.localeCompare(b, 'ru')));
        });
        return m;
    }, [rolesById, userRoles]);

    const filteredUsers = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return users;
        return users.filter((u) => {
            const rolesText = (roleKeysByUserId.get(Number(u.user_id)) || []).join(', ').toLowerCase();
            return (
                String(u.user_id).includes(s) ||
                String(u.employee_id ?? '').includes(s) ||
                String(u.fio || '').toLowerCase().includes(s) ||
                String(u.position || '').toLowerCase().includes(s) ||
                rolesText.includes(s)
            );
        });
    }, [q, roleKeysByUserId, users]);

    const openUser = (u: UserRow) => {
        setSelectedUser(u);
        setResetPassword('');
        setResetPasswordRepeat('');
        setResetResultPassword(null);
        setPasswordFormError(null);
        setShowResetPassword(false);
        setShowResetPasswordRepeat(false);
        setPermQ('');
        setIsUserOpen(true);
    };

    const openCreate = () => {
        setCreatedPassword(null);
        setCreatedUserId(null);
        setCreatePassword('');
        setSelectedEmployeeId(EMPTY);
        setIsCreateOpen(true);
    };

    const createUser = async () => {
        const empId = selectedEmployeeId === EMPTY ? 0 : Number(selectedEmployeeId);
        if (!Number.isInteger(empId) || empId <= 0) return;
        try {
            setSaving(true);
            setError(null);
            setCreatedPassword(null);
            setCreatedUserId(null);
            const res = await fetch('/api/admin/user-provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId: empId, password: createPassword.trim() || undefined }),
            });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            setCreatedPassword(typeof json?.password === 'string' ? json.password : null);
            setCreatedUserId(Number(json?.userId) || null);
            await fetchAll();
            await fetchEmployeesMissing();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const doResetPassword = async () => {
        if (!selectedUser) return;
        const nextPassword = resetPassword.trim();
        const repeatedPassword = resetPasswordRepeat.trim();

        if (!nextPassword) {
            setPasswordFormError('Введите новый пароль.');
            return;
        }

        if (!repeatedPassword) {
            setPasswordFormError('Повторите новый пароль.');
            return;
        }

        if (nextPassword !== repeatedPassword) {
            setPasswordFormError('Пароли не совпадают.');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setResetResultPassword(null);
            setPasswordFormError(null);
            const res = await fetch('/api/admin/user-provision', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedUser.user_id, password: nextPassword }),
            });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) {
                setPasswordFormError(json?.error || 'Ошибка смены пароля');
                return;
            }
            setResetResultPassword(typeof json?.password === 'string' ? json.password : null);
            setResetPassword('');
            setResetPasswordRepeat('');
            setShowResetPassword(false);
            setShowResetPasswordRepeat(false);
        } catch (e) {
            setPasswordFormError((e as any)?.message || 'Ошибка смены пароля');
        } finally {
            setSaving(false);
        }
    };

    const addRole = async (roleId: number) => {
        if (!selectedUser) return;
        try {
            setSaving(true);
            const res = await fetch('/api/admin/user-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedUser.user_id, roleId }),
            });
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            await fetchAll();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const removeRole = async (roleId: number) => {
        if (!selectedUser) return;
        try {
            setSaving(true);
            const res = await fetch(
                `/api/admin/user-roles?userId=${encodeURIComponent(String(selectedUser.user_id))}&roleId=${encodeURIComponent(String(roleId))}`,
                { method: 'DELETE' }
            );
            const json = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) throw new Error(json?.error || 'Ошибка');
            await fetchAll();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const setUserPermission = async (permissionId: number, mode: 'inherit' | 'allow' | 'deny') => {
        if (!selectedUser) return;
        try {
            setSaving(true);
            setError(null);

            if (mode === 'inherit') {
                const res = await fetch(
                    `/api/admin/user-permissions?userId=${encodeURIComponent(String(selectedUser.user_id))}&permissionId=${encodeURIComponent(String(permissionId))}`,
                    { method: 'DELETE' }
                );
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');
            } else {
                const res = await fetch('/api/admin/user-permissions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: selectedUser.user_id, permissionId, effect: mode }),
                });
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');
            }

            await fetchAll();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const selectedUserRoleIds = useMemo(() => {
        const set = new Set<number>();
        if (!selectedUser) return set;
        for (const link of userRoles) {
            if (Number((link as any).user_id) === Number(selectedUser.user_id)) {
                set.add(Number((link as any).role_id));
            }
        }
        return set;
    }, [selectedUser, userRoles]);

    const roleKeyById = useMemo(() => {
        const m = new Map<number, string>();
        for (const r of roles) m.set(Number(r.id), String(r.key));
        return m;
    }, [roles]);

    const selectedUserRoleKeys = useMemo(() => {
        const set = new Set<string>();
        selectedUserRoleIds.forEach((rid) => {
            const key = roleKeyById.get(rid);
            if (key) set.add(key);
        });
        return set;
    }, [roleKeyById, selectedUserRoleIds]);

    const isDirectorUser = useMemo(() => {
        return selectedUserRoleKeys.has('director');
    }, [selectedUserRoleKeys]);

    const permIdsByRoleId = useMemo(() => {
        const m = new Map<number, Set<number>>();
        for (const link of rolePermissions) {
            const rid = Number((link as any).role_id);
            const pid = Number((link as any).permission_id);
            const set = m.get(rid) || new Set<number>();
            set.add(pid);
            m.set(rid, set);
        }
        return m;
    }, [rolePermissions]);

    const inheritedPermIds = useMemo(() => {
        const set = new Set<number>();
        if (!selectedUser) return set;
        selectedUserRoleIds.forEach((roleId) => {
            const pset = permIdsByRoleId.get(roleId);
            if (!pset) return;
            pset.forEach((pid) => set.add(pid));
        });
        return set;
    }, [permIdsByRoleId, selectedUser, selectedUserRoleIds]);

    const userPermOverrideByPermId = useMemo(() => {
        const m = new Map<number, UserPermissionLink>();
        if (!selectedUser) return m;
        for (const up of userPermissions) {
            if (Number((up as any).user_id) !== Number(selectedUser.user_id)) continue;
            m.set(Number((up as any).permission_id), up as UserPermissionLink);
        }
        return m;
    }, [selectedUser, userPermissions]);

    const filteredPermissions = useMemo(() => {
        const s = permQ.trim().toLowerCase();
        if (!s) return permissions;
        return permissions.filter((p) => {
            return (
                String(p.id).includes(s) ||
                String(p.key || '').toLowerCase().includes(s) ||
                String(p.name || '').toLowerCase().includes(s) ||
                String(p.description || '').toLowerCase().includes(s)
            );
        });
    }, [permQ, permissions]);

    const permissionGroups = useMemo(() => {
        const pages: PermissionItem[] = [];
        const special: PermissionItem[] = [];
        const actionsByPage = new Map<string, PermissionItem[]>();

        for (const p of filteredPermissions) {
            const key = String(p.key || '');
            if (key.startsWith('page.')) {
                const n = normalizePermissionKeyForGrouping(key);
                if (n.groupKey && n.groupKey !== 'other') {
                    const arr = actionsByPage.get(n.groupKey) || [];
                    arr.push(p);
                    actionsByPage.set(n.groupKey, arr);
                } else {
                    pages.push(p);
                }
                continue;
            }

            if (key.startsWith('admin.') || key.startsWith('reports.')) {
                special.push(p);
                continue;
            }

            const n = normalizePermissionKeyForGrouping(key);
            const pageKey = n.groupKey || 'other';
            const arr = actionsByPage.get(pageKey) || [];
            arr.push(p);
            actionsByPage.set(pageKey, arr);
        }

        const actionSections = Array.from(actionsByPage.entries())
            .sort((a, b) => {
                const aOrder = PERMISSION_MODULE_ORDER.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
                const bOrder = PERMISSION_MODULE_ORDER.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a[0].localeCompare(b[0], 'ru');
            })
            .map(([pageKey, items]) => ({ pageKey, items: items.slice().sort(permKeyCompare) }));

        pages.sort(permKeyCompare);
        special.sort(permKeyCompare);

        return { pages, actionSections, special };
    }, [filteredPermissions]);

    const content = (
        <>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Пользователи</h1>
                        <div className={styles.subtitle}>Выберите пользователя и настройте роли/права/пароль (доступ: director)</div>
                    </div>
                    <div className={styles.actions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={() => void fetchAll()}
                        >
                            <FiRefreshCw className={styles.icon} />
                            Обновить
                        </Button>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButtonWide}`}
                            onClick={() => setIsRbacOpen(true)}
                        >
                            Настройки RBAC
                        </Button>
                        <Button
                            type="button"
                            variant="solid"
                            color="gray"
                            highContrast
                            className={`${styles.primaryButton} ${styles.headerActionButtonPrimary}`}
                            onClick={openCreate}
                        >
                            <FiPlus className={styles.icon} />
                            Создать пользователя
                        </Button>
                    </div>
                </div>
                <div className={styles.searchSection}>
                    <TextField.Root
                        className={styles.searchInput}
                        size="3"
                        radius="large"
                        variant="surface"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Поиск по ФИО, должности, роли, id…"
                    >
                        <TextField.Slot side="left">
                            <FiSearch height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>
                </div>
            </div>

            {error ? (
                <Box p="4">
                    <Text color="red">{error}</Text>
                </Box>
            ) : null}

            <div className={styles.usersTableCard}>
                <div className={styles.usersTableContainer}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>User ID</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Employee</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>ФИО</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Должность</Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>Роли</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {loading ? (
                                <Table.Row>
                                    <Table.Cell className={styles.tableCell} colSpan={5}>Загрузка…</Table.Cell>
                                </Table.Row>
                            ) : filteredUsers.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell className={styles.tableCell} colSpan={5}>Пусто</Table.Cell>
                                </Table.Row>
                            ) : (
                                filteredUsers.map((u) => {
                                    const roleKeys = roleKeysByUserId.get(Number(u.user_id)) || [];
                                    return (
                                        <Table.Row key={u.user_id} className={`${styles.tableRow} ${styles.userRow}`} onClick={() => openUser(u)}>
                                            <Table.Cell className={styles.tableCell}>#{u.user_id}</Table.Cell>
                                            <Table.Cell className={styles.tableCell}>{u.employee_id ? `#${u.employee_id}` : '—'}</Table.Cell>
                                            <Table.Cell className={styles.tableCell}>{u.fio || '—'}</Table.Cell>
                                            <Table.Cell className={styles.tableCell}>{u.position || '—'}</Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <Flex gap="2" wrap="wrap" className={styles.badges}>
                                                    {roleKeys.length === 0 ? (
                                                        <Text color="gray">—</Text>
                                                    ) : (
                                                        roleKeys.map((rk) => (
                                                            <Badge key={rk} color="gray" variant="soft" highContrast>
                                                                {rk}
                                                            </Badge>
                                                        ))
                                                    )}
                                                </Flex>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })
                            )}
                        </Table.Body>
                    </Table.Root>
                </div>
            </div>

            <Dialog.Root
                open={isUserOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsUserOpen(false);
                        setSelectedUser(null);
                        setUserTab('roles');
                        setResetPassword('');
                        setResetPasswordRepeat('');
                        setResetResultPassword(null);
                        setPasswordFormError(null);
                        setShowResetPassword(false);
                        setShowResetPasswordRepeat(false);
                        setPermQ('');
                    } else {
                        setIsUserOpen(true);
                    }
                }}
            >
                <Dialog.Content className={`${modalStyles.radixDialog} ${modalStyles.radixDialogUser}`}>
                    <Dialog.Title>Пользователь</Dialog.Title>
                    <Dialog.Description className={modalStyles.radixDescription}>
                        {selectedUser ? `${selectedUser.fio || '—'} (${selectedUser.position || '—'}) — user #${selectedUser.user_id}` : '—'}
                    </Dialog.Description>

                    {!selectedUser ? null : (
                        <div className={modalStyles.radixForm}>
                            <div className={modalStyles.radixField}>
                                <Tabs.Root value={userTab} onValueChange={(v) => setUserTab(v as any)}>
                                    <Tabs.List className={styles.userTabsList}>
                                        <Tabs.Trigger value="roles">Роли</Tabs.Trigger>
                                        <Tabs.Trigger value="permissions">Права</Tabs.Trigger>
                                        <Tabs.Trigger value="password">Пароль</Tabs.Trigger>
                                    </Tabs.List>
                                </Tabs.Root>
                            </div>

                            <div className={modalStyles.radixField}>
                                {userTab !== 'roles' ? null : (
                                    <>
                                        <Text weight="medium">Роли</Text>
                                        <div style={{ maxHeight: 520, overflow: 'auto' }}>
                                            {roles.length === 0 ? (
                                                <Text color="gray">Ролей нет</Text>
                                            ) : (
                                                <div className={styles.roleList}>
                                                    {roles.map((r) => {
                                                        const rid = Number(r.id);
                                                        const checked = selectedUserRoleIds.has(rid);
                                                        const permCount = permIdsByRoleId.get(rid)?.size ?? 0;
                                                        const posNorm = String(selectedUser?.position || '').trim().toLowerCase();
                                                        const isMainDirector = posNorm === 'главный директор';
                                                        const isDirectorRoleLocked = isMainDirector && r.key === 'director';
                                                        const isLastRole = checked && selectedUserRoleIds.size <= 1;
                                                        const disableUncheck = saving || isDirectorRoleLocked || isLastRole;

                                                        const toggleRole = () => {
                                                            if (saving) return;
                                                            const next = !checked;
                                                            if (!next) {
                                                                if (isDirectorRoleLocked) {
                                                                    setError('Нельзя снять роль director у главного директора.');
                                                                    return;
                                                                }
                                                                if (selectedUserRoleIds.size <= 1) {
                                                                    setError('У пользователя должна быть выбрана минимум одна роль.');
                                                                    return;
                                                                }
                                                            }
                                                            setError(null);
                                                            void (next ? addRole(rid) : removeRole(rid));
                                                        };

                                                        return (
                                                            <div
                                                                key={r.id}
                                                                className={`${styles.roleCard} ${checked ? styles.roleCardSelected : ''}`}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={toggleRole}
                                                                onKeyDown={(e) => {
                                                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                                                    e.preventDefault();
                                                                    toggleRole();
                                                                }}
                                                            >
                                                                <div className={styles.roleCardHeader}>
                                                                    <div className={styles.roleCardTitleRow}>
                                                                        <div
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                        >
                                                                            <Checkbox
                                                                                checked={checked}
                                                                                className={styles.roleCheckbox}
                                                                                disabled={disableUncheck}
                                                                                onCheckedChange={(v) => {
                                                                                    if (saving) return;
                                                                                    const next = v === true;
                                                                                    if (!next) {
                                                                                        if (isDirectorRoleLocked) {
                                                                                            setError('Нельзя снять роль director у главного директора.');
                                                                                            return;
                                                                                        }
                                                                                        if (selectedUserRoleIds.size <= 1) {
                                                                                            setError('У пользователя должна быть выбрана минимум одна роль.');
                                                                                            return;
                                                                                        }
                                                                                    }
                                                                                    setError(null);
                                                                                    void (next ? addRole(rid) : removeRole(rid));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <Text weight="medium" size="4">
                                                                            {r.name || r.key}
                                                                        </Text>
                                                                        <Badge color="gray" variant="surface" highContrast>
                                                                            {r.key}
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                {r.description ? (
                                                                    <Text size="2" className={styles.roleCardDesc}>
                                                                        {r.description}
                                                                    </Text>
                                                                ) : null}

                                                                <Text size="2" className={styles.roleCardCount}>
                                                                    {permCount} прав
                                                                </Text>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className={modalStyles.radixField}>
                                {userTab !== 'permissions' ? null : (
                                    <>
                                        <Flex justify="between" align="end" gap="3" wrap="wrap">
                                            <div>
                                                <Text weight="medium">Права</Text>
                                                <Text as="div" size="1" color="gray">
                                                    По умолчанию права наследуются от ролей. Можно переопределить: разрешить/запретить.
                                                </Text>
                                            </div>
                                            <div style={{ minWidth: 550 }}>
                                                <TextField.Root
                                                    value={permQ}
                                                    onChange={(e) => setPermQ(e.target.value)}
                                                    placeholder="Поиск по правам…"
                                                    size="3"
                                                />
                                            </div>
                                        </Flex>

                                        {isDirectorUser ? (
                                            <Text as="div" size="1" color="gray" mt="2">
                                                Для администратора права редактировать нельзя.
                                            </Text>
                                        ) : null}

                                        <div style={{ maxHeight: 520, overflow: 'auto' }}>
                                            {filteredPermissions.length === 0 ? (
                                                <Text color="gray">Пусто</Text>
                                            ) : (
                                                <div className={styles.permSections}>
                                                    <div className={styles.permSection}>
                                                        <div className={styles.permSectionHeader}>
                                                            <Text weight="medium">Доступ к страницам</Text>
                                                            <Badge color="gray" variant="surface" highContrast>
                                                                {permissionGroups.pages.length}
                                                            </Badge>
                                                        </div>
                                                        <div className={styles.permList}>
                                                            {permissionGroups.pages.map((p) => {
                                                                const pid = Number(p.id);
                                                                const override = userPermOverrideByPermId.get(pid);
                                                                const inherited = inheritedPermIds.has(pid);
                                                                const effectiveAllowed = isDirectorUser ? true : (override ? override.effect === 'allow' : inherited);
                                                                const fromRole = isDirectorUser ? true : (!override && inherited);
                                                                const interactive = !saving && !isDirectorUser && !fromRole;
                                                                const badgeText = isDirectorUser
                                                                    ? 'Из роли'
                                                                    : override
                                                                        ? override.effect === 'allow'
                                                                            ? 'Разрешено'
                                                                            : 'Запрещено'
                                                                        : inherited
                                                                            ? 'Из роли'
                                                                            : '';

                                                                const cycleMode = () => {
                                                                    if (!interactive) return;
                                                                    const current = override ? override.effect : 'inherit';
                                                                    const next: 'inherit' | 'allow' | 'deny' =
                                                                        current === 'inherit' ? 'allow' : current === 'allow' ? 'deny' : 'inherit';
                                                                    void setUserPermission(pid, next);
                                                                };

                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        className={`${styles.permCard} ${fromRole ? styles.permCardAllowed : ''} ${override ? styles.permCardOverride : ''} ${override?.effect === 'allow' ? styles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? styles.permCardOverrideDeny : ''} ${interactive ? styles.permCardInteractive : ''}`}
                                                                        role={interactive ? 'button' : undefined}
                                                                        tabIndex={interactive ? 0 : -1}
                                                                        onClick={cycleMode}
                                                                        onKeyDown={(e) => {
                                                                            if (!interactive) return;
                                                                            if (e.key !== 'Enter' && e.key !== ' ') return;
                                                                            e.preventDefault();
                                                                            cycleMode();
                                                                        }}
                                                                    >
                                                                        <div className={styles.permCardHeader}>
                                                                            <div className={styles.permCardTitleRow}>
                                                                                <Checkbox checked={effectiveAllowed} disabled className={styles.permCheckbox} />
                                                                                <div>
                                                                                    <Text weight="medium" size="4">
                                                                                        {p.name || p.key}
                                                                                    </Text>
                                                                                    <Text as="div" size="2" color="gray" className={styles.permKeyText}>
                                                                                        {p.key}
                                                                                    </Text>
                                                                                </div>
                                                                            </div>
                                                                            {badgeText ? (
                                                                                <span className={styles.permBadge}>{badgeText}</span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className={styles.permSection}>
                                                        <div className={styles.permSectionHeader}>
                                                            <Text weight="medium">Действия на страницах</Text>
                                                            <Badge color="gray" variant="surface" highContrast>
                                                                {permissionGroups.actionSections.reduce((acc, s) => acc + s.items.length, 0)}
                                                            </Badge>
                                                        </div>

                                                        {permissionGroups.actionSections.map((sec) => (
                                                            <div key={sec.pageKey} className={styles.permSubSection}>
                                                                <Text weight="medium" color="gray">
                                                                    {getPermissionModuleLabel(sec.pageKey)}
                                                                </Text>
                                                                <div className={styles.permList}>
                                                                    {sec.items.map((p) => {
                                                                        const pid = Number(p.id);
                                                                        const override = userPermOverrideByPermId.get(pid);
                                                                        const inherited = inheritedPermIds.has(pid);
                                                                        const effectiveAllowed = isDirectorUser ? true : (override ? override.effect === 'allow' : inherited);
                                                                        const fromRole = isDirectorUser ? true : (!override && inherited);
                                                                        const interactive = !saving && !isDirectorUser && !fromRole;
                                                                        const badgeText = isDirectorUser
                                                                            ? 'Из роли'
                                                                            : override
                                                                                ? override.effect === 'allow'
                                                                                    ? 'Разрешено'
                                                                                    : 'Запрещено'
                                                                                : inherited
                                                                                    ? 'Из роли'
                                                                                    : '';

                                                                        const cycleMode = () => {
                                                                            if (!interactive) return;
                                                                            const current = override ? override.effect : 'inherit';
                                                                            const next: 'inherit' | 'allow' | 'deny' =
                                                                                current === 'inherit' ? 'allow' : current === 'allow' ? 'deny' : 'inherit';
                                                                            void setUserPermission(pid, next);
                                                                        };

                                                                        return (
                                                                            <div
                                                                                key={p.id}
                                                                                className={`${styles.permCard} ${fromRole ? styles.permCardAllowed : ''} ${override ? styles.permCardOverride : ''} ${override?.effect === 'allow' ? styles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? styles.permCardOverrideDeny : ''} ${interactive ? styles.permCardInteractive : ''}`}
                                                                                role={interactive ? 'button' : undefined}
                                                                                tabIndex={interactive ? 0 : -1}
                                                                                onClick={cycleMode}
                                                                                onKeyDown={(e) => {
                                                                                    if (!interactive) return;
                                                                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                                                                    e.preventDefault();
                                                                                    cycleMode();
                                                                                }}
                                                                            >
                                                                                <div className={styles.permCardHeader}>
                                                                                    <div className={styles.permCardTitleRow}>
                                                                                        <Checkbox checked={effectiveAllowed} disabled className={styles.permCheckbox} />
                                                                                        <div>
                                                                                            <Text weight="medium" size="4">
                                                                                                {p.name || p.key}
                                                                                            </Text>
                                                                                            <Text as="div" size="2" color="gray" className={styles.permKeyText}>
                                                                                                {p.key}
                                                                                            </Text>
                                                                                        </div>
                                                                                    </div>
                                                                                    {badgeText ? (
                                                                                        <span className={styles.permBadge}>{badgeText}</span>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className={styles.permSection}>
                                                        <div className={styles.permSectionHeader}>
                                                            <Text weight="medium">Специальные права</Text>
                                                            <Badge color="gray" variant="surface" highContrast>
                                                                {permissionGroups.special.length}
                                                            </Badge>
                                                        </div>
                                                        <div className={styles.permList}>
                                                            {permissionGroups.special.map((p) => {
                                                                const pid = Number(p.id);
                                                                const override = userPermOverrideByPermId.get(pid);
                                                                const inherited = inheritedPermIds.has(pid);
                                                                const effectiveAllowed = isDirectorUser ? true : (override ? override.effect === 'allow' : inherited);
                                                                const fromRole = isDirectorUser ? true : (!override && inherited);
                                                                const interactive = !saving && !isDirectorUser && !fromRole;
                                                                const badgeText = isDirectorUser
                                                                    ? 'Из роли'
                                                                    : override
                                                                        ? override.effect === 'allow'
                                                                            ? 'Разрешено'
                                                                            : 'Запрещено'
                                                                        : inherited
                                                                            ? 'Из роли'
                                                                            : '';

                                                                const cycleMode = () => {
                                                                    if (!interactive) return;
                                                                    const current = override ? override.effect : 'inherit';
                                                                    const next: 'inherit' | 'allow' | 'deny' =
                                                                        current === 'inherit' ? 'allow' : current === 'allow' ? 'deny' : 'inherit';
                                                                    void setUserPermission(pid, next);
                                                                };

                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        className={`${styles.permCard} ${fromRole ? styles.permCardAllowed : ''} ${override ? styles.permCardOverride : ''} ${override?.effect === 'allow' ? styles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? styles.permCardOverrideDeny : ''} ${interactive ? styles.permCardInteractive : ''}`}
                                                                        role={interactive ? 'button' : undefined}
                                                                        tabIndex={interactive ? 0 : -1}
                                                                        onClick={cycleMode}
                                                                        onKeyDown={(e) => {
                                                                            if (!interactive) return;
                                                                            if (e.key !== 'Enter' && e.key !== ' ') return;
                                                                            e.preventDefault();
                                                                            cycleMode();
                                                                        }}
                                                                    >
                                                                        <div className={styles.permCardHeader}>
                                                                            <div className={styles.permCardTitleRow}>
                                                                                <Checkbox checked={effectiveAllowed} disabled className={styles.permCheckbox} />
                                                                                <div>
                                                                                    <Text weight="medium" size="4">
                                                                                        {p.name || p.key}
                                                                                    </Text>
                                                                                    <Text as="div" size="2" color="gray" className={styles.permKeyText}>
                                                                                        {p.key}
                                                                                    </Text>
                                                                                </div>
                                                                            </div>
                                                                            {badgeText ? <span className={styles.permBadge}>{badgeText}</span> : null}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className={modalStyles.radixField}>
                                {userTab !== 'password' ? null : (
                                    <>
                                        <Text weight="medium">Пароль</Text>
                                        <Text as="div" size="1" color="gray">
                                            Текущий пароль нельзя показать: в системе хранится только его хеш. Ниже можно задать новый пароль.
                                        </Text>

                                        <div className={styles.passwordInfoBox}>
                                            <Text size="2" color="gray">
                                                Для безопасности мы не храним текущий пароль в открытом виде, поэтому посмотреть его нельзя. Но можно сразу установить новый.
                                            </Text>
                                        </div>

                                        <div className={styles.passwordFieldGroup}>
                                            <Text as="label" size="2" weight="medium" htmlFor="admin-user-password">
                                                Введите новый пароль
                                            </Text>
                                            <TextField.Root
                                                id="admin-user-password"
                                                className={`${styles.passwordInput} ${passwordFormError ? styles.passwordInputError : ''}`}
                                                type={showResetPassword ? 'text' : 'password'}
                                                value={resetPassword}
                                                onChange={(e) => {
                                                    setResetPassword((e.target as HTMLInputElement).value);
                                                    if (passwordFormError) setPasswordFormError(null);
                                                    if (resetResultPassword) setResetResultPassword(null);
                                                }}
                                                placeholder="Введите новый пароль"
                                                size="3"
                                            >
                                                <TextField.Slot side="left">
                                                    <Lock size={18} />
                                                </TextField.Slot>
                                                <TextField.Slot side="right">
                                                    <button
                                                        type="button"
                                                        aria-label={showResetPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowResetPassword((v) => !v)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showResetPassword ? <EyeOff size={28} /> : <Eye size={28} />}
                                                    </button>
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </div>

                                        <div className={styles.passwordFieldGroup}>
                                            <Text as="label" size="2" weight="medium" htmlFor="admin-user-password-repeat">
                                                Повторите новый пароль
                                            </Text>
                                            <TextField.Root
                                                id="admin-user-password-repeat"
                                                className={`${styles.passwordInput} ${passwordFormError ? styles.passwordInputError : ''}`}
                                                type={showResetPasswordRepeat ? 'text' : 'password'}
                                                value={resetPasswordRepeat}
                                                onChange={(e) => {
                                                    setResetPasswordRepeat((e.target as HTMLInputElement).value);
                                                    if (passwordFormError) setPasswordFormError(null);
                                                    if (resetResultPassword) setResetResultPassword(null);
                                                }}
                                                placeholder="Повторите новый пароль"
                                                size="3"
                                            >
                                                <TextField.Slot side="left">
                                                    <Lock size={18} />
                                                </TextField.Slot>
                                                <TextField.Slot side="right">
                                                    <button
                                                        type="button"
                                                        aria-label={showResetPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowResetPasswordRepeat((v) => !v)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showResetPasswordRepeat ? <EyeOff size={28} /> : <Eye size={28} />}
                                                    </button>
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </div>

                                        {passwordFormError ? (
                                            <Text as="div" size="2" className={styles.passwordErrorText}>
                                                {passwordFormError}
                                            </Text>
                                        ) : null}

                                        <Flex justify="end" gap="3" mt="2">
                                            <Button
                                                type="button"
                                                variant="solid"
                                                color="gray"
                                                highContrast
                                                onClick={() => void doResetPassword()}
                                                disabled={saving}
                                                loading={saving}
                                                className={modalStyles.primaryButton}
                                            >
                                                {saving ? 'Смена…' : 'Сменить пароль'}
                                            </Button>
                                        </Flex>

                                        {resetResultPassword ? (
                                            <Text as="div" size="2" className={styles.passwordSuccessText}>
                                                Пароль успешно обновлен.
                                            </Text>
                                        ) : null}
                                    </>
                                )}
                            </div>

                            {error ? <div className={modalStyles.error}>{error}</div> : null}

                            <Flex justify="end" gap="3" mt="2" className={modalStyles.radixActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsUserOpen(false)}
                                    disabled={saving}
                                    className={modalStyles.secondaryButton}
                                >
                                    Закрыть
                                </Button>
                            </Flex>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root
                open={isRbacOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsRbacOpen(false);
                        setRbacTab('roles');
                        void fetchAll();
                    } else {
                        setIsRbacOpen(true);
                        void fetchAll();
                    }
                }}
            >
                <Dialog.Content className={`${modalStyles.radixDialog} ${modalStyles.radixDialogRbac}`}>
                    <Dialog.Title>Настройки RBAC</Dialog.Title>
                    <Dialog.Description className={modalStyles.radixDescription}>
                        Роли, права и права ролей. Для обычной работы выдавайте доступ через карточку пользователя.
                    </Dialog.Description>

                    <div className={modalStyles.radixForm} style={{ flex: 1, minHeight: 0 }}>
                        <div className={modalStyles.radixField}>
                            <Tabs.Root value={rbacTab} onValueChange={(v) => setRbacTab(v as any)}>
                                <Tabs.List className={styles.userTabsList}>
                                    <Tabs.Trigger value="roles">Роли</Tabs.Trigger>
                                    <Tabs.Trigger value="permissions">Права</Tabs.Trigger>
                                    <Tabs.Trigger value="role-permissions">Права ролей</Tabs.Trigger>
                                </Tabs.List>
                            </Tabs.Root>
                        </div>

                        <div className={modalStyles.radixField} style={{ flex: 1, minHeight: 0 }}>
                            <div style={{ height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
                                {rbacTab === 'roles' ? (
                                    <RolesAdmin embedded />
                                ) : rbacTab === 'permissions' ? (
                                    <PermissionsAdmin embedded />
                                ) : (
                                    <RolePermissionsAdmin embedded onChanged={fetchAll} />
                                )}
                            </div>
                        </div>

                        <Flex justify="end" gap="3" mt="2" className={modalStyles.radixActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => setIsRbacOpen(false)}
                                className={modalStyles.secondaryButton}
                            >
                                Закрыть
                            </Button>
                        </Flex>
                    </div>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root
                open={isCreateOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsCreateOpen(false);
                        setSelectedEmployeeId(EMPTY);
                        setCreatePassword('');
                        setCreatedPassword(null);
                        setCreatedUserId(null);
                    } else {
                        setIsCreateOpen(true);
                    }
                }}
            >
                <Dialog.Content className={modalStyles.radixDialog}>
                    <Dialog.Title>Создать пользователя</Dialog.Title>
                    <Dialog.Description className={modalStyles.radixDescription}>
                        Создание учетной записи в таблице users для выбранного сотрудника.
                    </Dialog.Description>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void createUser();
                        }}
                        className={modalStyles.radixForm}
                    >
                        <div className={modalStyles.radixField}>
                            <Text as="label" size="2" weight="medium" htmlFor="create-user-employee">
                                Сотрудник
                            </Text>
                            <Select.Root value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                <Select.Trigger
                                    id="create-user-employee"
                                    placeholder="Выберите сотрудника"
                                    className={modalStyles.radixSelectTrigger}
                                />
                                <Select.Content position="popper" className={modalStyles.radixSelectContent}>
                                    <Select.Item value={EMPTY}>Выберите сотрудника</Select.Item>
                                    {employeesMissingUser.map((e) => (
                                        <Select.Item key={e.id} value={String(e.id)}>
                                            {e.fio} {e.position ? `(${e.position})` : ''}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </div>

                        <div className={modalStyles.radixField}>
                            <Text as="label" size="2" weight="medium" htmlFor="create-user-password">
                                Пароль (опционально)
                            </Text>
                            <TextField.Root
                                id="create-user-password"
                                value={createPassword}
                                onChange={(e) => setCreatePassword((e.target as HTMLInputElement).value)}
                                placeholder="Если пусто — сгенерируем автоматически"
                                size="3"
                            />
                        </div>

                        {createdPassword ? (
                            <div className={modalStyles.radixField}>
                                <Text weight="medium">Пароль для выдачи сотруднику</Text>
                                <Box mt="2" p="2" style={{ border: '1px solid #e0e0e0', borderRadius: 10 }}>
                                    <Text className={styles.mono}>{createdPassword}</Text>
                                    {createdUserId ? (
                                        <Text size="2" color="gray" style={{ marginTop: 6 }}>
                                            user #{createdUserId}
                                        </Text>
                                    ) : null}
                                </Box>
                            </div>
                        ) : null}

                        {error ? <div className={modalStyles.error}>{error}</div> : null}

                        <Flex justify="end" gap="3" mt="5" className={modalStyles.radixActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => setIsCreateOpen(false)}
                                disabled={saving}
                                className={modalStyles.secondaryButton}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                color="gray"
                                highContrast
                                disabled={saving || selectedEmployeeId === EMPTY}
                                loading={saving}
                                className={modalStyles.primaryButton}
                            >
                                {saving ? 'Создание…' : 'Создать'}
                            </Button>
                        </Flex>
                    </form>
                </Dialog.Content>
            </Dialog.Root>

        </>
    );

    if (embedded) return <div>{content}</div>;

    return <div className={styles.container}>{content}</div>;
}
