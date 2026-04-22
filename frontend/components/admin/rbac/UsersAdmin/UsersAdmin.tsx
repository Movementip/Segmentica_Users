import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { CreateEntityButton } from '@/components/CreateEntityButton/CreateEntityButton';
import { DataSearchField } from '@/components/DataSearchField/DataSearchField';
import { EntityTableSkeleton, EntityTableSurface } from '@/components/EntityDataTable/EntityDataTable';
import { SegmentedTabs } from '@/components/SegmentedTabs/SegmentedTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { lockBodyScroll, scheduleForceUnlockBodyScroll } from '@/utils/bodyScrollLock';

import { PermissionsAdmin } from '../PermissionsAdmin/PermissionsAdmin';
import { RolePermissionsAdmin } from '../RolePermissionsAdmin/RolePermissionsAdmin';
import { RolesAdmin } from '../RolesAdmin/RolesAdmin';
import {
    getPermissionModuleLabel,
    normalizePermissionKeyForGrouping,
    PERMISSION_MODULE_ORDER,
    permKeyCompare,
} from '../shared/permissionGroups';
import dialogStyles from '../shared/RbacDialog.module.css';
import sharedStyles from '../shared/RbacShared.module.css';
import { UsersPageHeader } from './UsersPageHeader/UsersPageHeader';
import pageStyles from './UsersAdmin.module.css';
import { UsersPageSkeleton } from './UsersPageSkeleton/UsersPageSkeleton';
import { UsersStats } from './UsersStats/UsersStats';
import { UsersTable } from './UsersTable/UsersTable';
import type { UserRow } from './types';

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
    effect: 'allow' | 'deny';
};

type EmployeeCandidate = {
    id: number;
    fio: string;
    position: string | null;
};

const EMPTY = '__empty__';

export function UsersAdmin({ embedded }: { embedded?: boolean }): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [users, setUsers] = useState<UserRow[]>([]);
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [userRoles, setUserRoles] = useState<UserRoleLink[]>([]);
    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermissionLink[]>([]);
    const [userPermissions, setUserPermissions] = useState<UserPermissionLink[]>([]);

    const [query, setQuery] = useState('');
    const [permissionQuery, setPermissionQuery] = useState('');

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
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);

    const isAnyDialogOpen = isCreateOpen || isUserOpen || isRbacOpen;

    useEffect(() => {
        if (!isAnyDialogOpen) {
            scheduleForceUnlockBodyScroll();
            return;
        }

        const unlockBodyScroll = lockBodyScroll();
        return () => {
            unlockBodyScroll();
            scheduleForceUnlockBodyScroll();
        };
    }, [isAnyDialogOpen]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const timeoutId = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(timeoutId);
    }, [minRefreshSpinActive]);

    const fetchAll = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);

            const [usersResponse, rolesResponse, userRolesResponse, permissionsResponse, rolePermissionsResponse, userPermissionsResponse] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/roles'),
                fetch('/api/admin/user-roles'),
                fetch('/api/admin/permissions'),
                fetch('/api/admin/role-permissions'),
                fetch('/api/admin/user-permissions'),
            ]);

            const usersJson = (await usersResponse.json().catch(() => ({}))) as any;
            const rolesJson = (await rolesResponse.json().catch(() => ({}))) as any;
            const userRolesJson = (await userRolesResponse.json().catch(() => ({}))) as any;
            const permissionsJson = (await permissionsResponse.json().catch(() => ({}))) as any;
            const rolePermissionsJson = (await rolePermissionsResponse.json().catch(() => ({}))) as any;
            const userPermissionsJson = (await userPermissionsResponse.json().catch(() => ({}))) as any;

            if (!usersResponse.ok) throw new Error(usersJson?.error || 'Ошибка');
            if (!rolesResponse.ok) throw new Error(rolesJson?.error || 'Ошибка');
            if (!userRolesResponse.ok) throw new Error(userRolesJson?.error || 'Ошибка');
            if (!permissionsResponse.ok) throw new Error(permissionsJson?.error || 'Ошибка');
            if (!rolePermissionsResponse.ok) throw new Error(rolePermissionsJson?.error || 'Ошибка');
            if (!userPermissionsResponse.ok) throw new Error(userPermissionsJson?.error || 'Ошибка');

            setUsers(Array.isArray(usersJson?.items) ? usersJson.items : []);
            setRoles(Array.isArray(rolesJson?.items) ? rolesJson.items : []);
            setUserRoles(Array.isArray(userRolesJson?.items) ? userRolesJson.items : []);
            setPermissions(Array.isArray(permissionsJson?.items) ? permissionsJson.items : []);
            setRolePermissions(Array.isArray(rolePermissionsJson?.items) ? rolePermissionsJson.items : []);
            setUserPermissions(Array.isArray(userPermissionsJson?.items) ? userPermissionsJson.items : []);
        } catch (errorResponse) {
            setError((errorResponse as any)?.message || 'Ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    }, []);

    const fetchEmployeesMissing = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/user-provision');
            const json = (await response.json().catch(() => ({}))) as any;
            if (!response.ok) throw new Error(json?.error || 'Ошибка');
            setEmployeesMissingUser(Array.isArray(json?.items) ? json.items : []);
        } catch (errorResponse) {
            setEmployeesMissingUser([]);
            setError((errorResponse as any)?.message || 'Ошибка');
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
        const map = new Map<number, RoleItem>();
        for (const role of roles) map.set(Number(role.id), role);
        return map;
    }, [roles]);

    const roleKeysByUserId = useMemo(() => {
        const map = new Map<number, string[]>();

        for (const link of userRoles) {
            const userId = Number((link as any).user_id);
            const roleId = Number((link as any).role_id);
            const role = rolesById.get(roleId);
            if (!role) continue;

            const values = map.get(userId) || [];
            values.push(String(role.key));
            map.set(userId, values);
        }

        map.forEach((values, key) => {
            map.set(key, values.sort((a, b) => a.localeCompare(b, 'ru')));
        });

        return map;
    }, [rolesById, userRoles]);

    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return users;

        return users.filter((user) => {
            const rolesText = (roleKeysByUserId.get(Number(user.user_id)) || []).join(', ').toLowerCase();
            return (
                String(user.user_id).includes(normalizedQuery) ||
                String(user.employee_id ?? '').includes(normalizedQuery) ||
                String(user.fio || '').toLowerCase().includes(normalizedQuery) ||
                String(user.position || '').toLowerCase().includes(normalizedQuery) ||
                rolesText.includes(normalizedQuery)
            );
        });
    }, [query, roleKeysByUserId, users]);

    const permissionIdsByRoleId = useMemo(() => {
        const map = new Map<number, Set<number>>();
        for (const link of rolePermissions) {
            const roleId = Number((link as any).role_id);
            const permissionId = Number((link as any).permission_id);
            const set = map.get(roleId) || new Set<number>();
            set.add(permissionId);
            map.set(roleId, set);
        }
        return map;
    }, [rolePermissions]);

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
        const map = new Map<number, string>();
        for (const role of roles) map.set(Number(role.id), String(role.key));
        return map;
    }, [roles]);

    const selectedUserRoleKeys = useMemo(() => {
        const set = new Set<string>();
        selectedUserRoleIds.forEach((roleId) => {
            const roleKey = roleKeyById.get(roleId);
            if (roleKey) set.add(roleKey);
        });
        return set;
    }, [roleKeyById, selectedUserRoleIds]);

    const isDirectorUser = useMemo(() => selectedUserRoleKeys.has('director'), [selectedUserRoleKeys]);

    const inheritedPermissionIds = useMemo(() => {
        const set = new Set<number>();
        if (!selectedUser) return set;

        selectedUserRoleIds.forEach((roleId) => {
            const permissionSet = permissionIdsByRoleId.get(roleId);
            if (!permissionSet) return;
            permissionSet.forEach((permissionId) => set.add(permissionId));
        });

        return set;
    }, [permissionIdsByRoleId, selectedUser, selectedUserRoleIds]);

    const userPermissionOverrideByPermissionId = useMemo(() => {
        const map = new Map<number, UserPermissionLink>();
        if (!selectedUser) return map;

        for (const userPermission of userPermissions) {
            if (Number((userPermission as any).user_id) !== Number(selectedUser.user_id)) continue;
            map.set(Number((userPermission as any).permission_id), userPermission as UserPermissionLink);
        }

        return map;
    }, [selectedUser, userPermissions]);

    const filteredPermissions = useMemo(() => {
        const normalizedQuery = permissionQuery.trim().toLowerCase();
        if (!normalizedQuery) return permissions;

        return permissions.filter((permission) => {
            return (
                String(permission.id).includes(normalizedQuery) ||
                String(permission.key || '').toLowerCase().includes(normalizedQuery) ||
                String(permission.name || '').toLowerCase().includes(normalizedQuery) ||
                String(permission.description || '').toLowerCase().includes(normalizedQuery)
            );
        });
    }, [permissionQuery, permissions]);

    const permissionGroups = useMemo(() => {
        const pages: PermissionItem[] = [];
        const special: PermissionItem[] = [];
        const actionsByPage = new Map<string, PermissionItem[]>();

        for (const permission of filteredPermissions) {
            const key = String(permission.key || '');

            if (key.startsWith('page.')) {
                const normalized = normalizePermissionKeyForGrouping(key);
                if (normalized.groupKey && normalized.groupKey !== 'other') {
                    const items = actionsByPage.get(normalized.groupKey) || [];
                    items.push(permission);
                    actionsByPage.set(normalized.groupKey, items);
                } else {
                    pages.push(permission);
                }
                continue;
            }

            if (key.startsWith('admin.') || key.startsWith('reports.')) {
                special.push(permission);
                continue;
            }

            const normalized = normalizePermissionKeyForGrouping(key);
            const pageKey = normalized.groupKey || 'other';
            const items = actionsByPage.get(pageKey) || [];
            items.push(permission);
            actionsByPage.set(pageKey, items);
        }

        const actionSections = Array.from(actionsByPage.entries())
            .sort((a, b) => {
                const aOrder = PERMISSION_MODULE_ORDER.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
                const bOrder = PERMISSION_MODULE_ORDER.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a[0].localeCompare(b[0], 'ru');
            })
            .map(([pageKey, items]) => ({
                pageKey,
                items: items.slice().sort(permKeyCompare),
            }));

        pages.sort(permKeyCompare);
        special.sort(permKeyCompare);

        return { pages, actionSections, special };
    }, [filteredPermissions]);

    const resetUserModalState = () => {
        setIsUserOpen(false);
        setSelectedUser(null);
        setUserTab('roles');
        setResetPassword('');
        setResetPasswordRepeat('');
        setResetResultPassword(null);
        setPasswordFormError(null);
        setShowResetPassword(false);
        setShowResetPasswordRepeat(false);
        setPermissionQuery('');
    };

    const openUser = (user: UserRow) => {
        setSelectedUser(user);
        setResetPassword('');
        setResetPasswordRepeat('');
        setResetResultPassword(null);
        setPasswordFormError(null);
        setShowResetPassword(false);
        setShowResetPasswordRepeat(false);
        setPermissionQuery('');
        setUserTab('roles');
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
        const employeeId = selectedEmployeeId === EMPTY ? 0 : Number(selectedEmployeeId);
        if (!Number.isInteger(employeeId) || employeeId <= 0) return;

        try {
            setSaving(true);
            setError(null);
            setCreatedPassword(null);
            setCreatedUserId(null);

            const response = await fetch('/api/admin/user-provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId,
                    password: createPassword.trim() || undefined,
                }),
            });
            const json = (await response.json().catch(() => ({}))) as any;
            if (!response.ok) throw new Error(json?.error || 'Ошибка');

            setCreatedPassword(typeof json?.password === 'string' ? json.password : null);
            setCreatedUserId(Number(json?.userId) || null);

            await fetchAll();
            await fetchEmployeesMissing();
        } catch (errorResponse) {
            setError((errorResponse as any)?.message || 'Ошибка');
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

            const response = await fetch('/api/admin/user-provision', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.user_id,
                    password: nextPassword,
                }),
            });
            const json = (await response.json().catch(() => ({}))) as any;
            if (!response.ok) {
                setPasswordFormError(json?.error || 'Ошибка смены пароля');
                return;
            }

            setResetResultPassword(typeof json?.password === 'string' ? json.password : null);
            setResetPassword('');
            setResetPasswordRepeat('');
            setShowResetPassword(false);
            setShowResetPasswordRepeat(false);
        } catch (errorResponse) {
            setPasswordFormError((errorResponse as any)?.message || 'Ошибка смены пароля');
        } finally {
            setSaving(false);
        }
    };

    const addRole = async (roleId: number) => {
        if (!selectedUser) return;

        try {
            setSaving(true);

            const response = await fetch('/api/admin/user-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedUser.user_id, roleId }),
            });
            const json = (await response.json().catch(() => ({}))) as any;
            if (!response.ok) throw new Error(json?.error || 'Ошибка');

            await fetchAll();
        } catch (errorResponse) {
            setError((errorResponse as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const removeRole = async (roleId: number) => {
        if (!selectedUser) return;

        try {
            setSaving(true);

            const response = await fetch(
                `/api/admin/user-roles?userId=${encodeURIComponent(String(selectedUser.user_id))}&roleId=${encodeURIComponent(String(roleId))}`,
                { method: 'DELETE' }
            );
            const json = (await response.json().catch(() => ({}))) as any;
            if (!response.ok) throw new Error(json?.error || 'Ошибка');

            await fetchAll();
        } catch (errorResponse) {
            setError((errorResponse as any)?.message || 'Ошибка');
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
                const response = await fetch(
                    `/api/admin/user-permissions?userId=${encodeURIComponent(String(selectedUser.user_id))}&permissionId=${encodeURIComponent(String(permissionId))}`,
                    { method: 'DELETE' }
                );
                const json = (await response.json().catch(() => ({}))) as any;
                if (!response.ok) throw new Error(json?.error || 'Ошибка');
            } else {
                const response = await fetch('/api/admin/user-permissions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: selectedUser.user_id,
                        permissionId,
                        effect: mode,
                    }),
                });
                const json = (await response.json().catch(() => ({}))) as any;
                if (!response.ok) throw new Error(json?.error || 'Ошибка');
            }

            await fetchAll();
        } catch (errorResponse) {
            setError((errorResponse as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <>
            <UsersPageHeader
                isRefreshing={loading || isFetching || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                onRefresh={() => {
                    setIsFetching(true);
                    setTableKey((value) => value + 1);
                    setRefreshClickKey((value) => value + 1);
                    setMinRefreshSpinActive(true);
                    void fetchAll();
                }}
                onOpenRbac={() => setIsRbacOpen(true)}
                onCreate={openCreate}
            />

            {loading && users.length === 0 ? (
                <UsersPageSkeleton />
            ) : (
                <div className={pageStyles.card}>
                    <UsersStats users={users} roleKeysByUserId={roleKeysByUserId} />

                    <div className={pageStyles.searchSection}>
                        <DataSearchField
                            wrapperClassName={pageStyles.searchInputWrapper}
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Поиск по сотрудникам, должности, роли и ID..."
                        />
                    </div>

                    {loading ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={pageStyles.tableContainer} key={tableKey}>
                            <EntityTableSkeleton columns={6} rows={7} actionColumn={false} />
                        </EntityTableSurface>
                    ) : error ? (
                        <div className={pageStyles.errorState}>
                            <p className={pageStyles.errorText}>{error}</p>
                            <Button type="button" className={pageStyles.retryButton} onClick={() => void fetchAll()}>
                                Повторить попытку
                            </Button>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className={pageStyles.emptyState}>
                            <p>Учетные записи не найдены</p>
                            <CreateEntityButton onClick={openCreate}>
                                Создать пользователя
                            </CreateEntityButton>
                        </div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={pageStyles.tableContainer} key={tableKey}>
                            <UsersTable
                                users={filteredUsers}
                                roleKeysByUserId={roleKeysByUserId}
                                onOpenUser={openUser}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}

            <Dialog
                open={isCreateOpen}
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) {
                        setCreatePassword('');
                        setSelectedEmployeeId(EMPTY);
                        setCreatedPassword(null);
                        setCreatedUserId(null);
                    }
                }}
            >
                <DialogContent className={`${dialogStyles.dialogContent} ${dialogStyles.dialogContentNarrow}`}>
                    <DialogHeader className={dialogStyles.dialogHeader}>
                        <DialogTitle className={dialogStyles.dialogTitle}>Создать пользователя</DialogTitle>
                        <DialogDescription className={dialogStyles.dialogDescription}>
                            Выберите сотрудника без учетной записи и при необходимости задайте пароль.
                        </DialogDescription>
                    </DialogHeader>

                    <div className={`${dialogStyles.dialogBody} ${pageStyles.rbacDialogShell}`}>
                        <label className={dialogStyles.field}>
                            <span className={dialogStyles.fieldLabel}>Сотрудник</span>
                            <Select
                                value={selectedEmployeeId}
                                onValueChange={(value) => {
                                    if (typeof value === 'string') setSelectedEmployeeId(value);
                                }}
                            >
                                <SelectTrigger
                                    className={`${dialogStyles.selectTrigger} ${pageStyles.purchaseSelectTrigger}`}
                                    placeholder="Выберите сотрудника"
                                />
                                <SelectContent className={dialogStyles.selectContent}>
                                    <SelectItem value={EMPTY}>Не выбрано</SelectItem>
                                    {employeesMissingUser.map((employee) => (
                                        <SelectItem key={employee.id} value={String(employee.id)}>
                                            {employee.fio}{employee.position ? ` — ${employee.position}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className={dialogStyles.field}>
                            <span className={dialogStyles.fieldLabel}>Пароль</span>
                            <div className={`${dialogStyles.passwordField} ${pageStyles.passwordField}`}>
                                <Lock className={pageStyles.passwordIcon} />
                                <Input
                                    className={`${dialogStyles.input} ${pageStyles.passwordInput}`}
                                    type="text"
                                    value={createPassword}
                                    onChange={(event) => setCreatePassword(event.target.value)}
                                    placeholder="Если пусто, сгенерируется автоматически"
                                />
                            </div>
                        </label>

                        {createdUserId ? (
                            <div className={pageStyles.successBox}>
                                <div className={pageStyles.successTitle}>Пользователь создан</div>
                                <div className={pageStyles.successText}>
                                    user #{createdUserId}{createdPassword ? `, пароль: ${createdPassword}` : ''}
                                </div>
                            </div>
                        ) : null}

                        <div className={dialogStyles.actions}>
                            <Button
                                type="button"
                                variant="outline"
                                className={dialogStyles.secondaryButton}
                                onClick={() => {
                                    setIsCreateOpen(false);
                                    setCreatePassword('');
                                    setSelectedEmployeeId(EMPTY);
                                    setCreatedPassword(null);
                                    setCreatedUserId(null);
                                }}
                                disabled={saving}
                            >
                                Закрыть
                            </Button>
                            <Button
                                type="button"
                                className={dialogStyles.primaryButton}
                                disabled={saving || selectedEmployeeId === EMPTY}
                                onClick={() => void createUser()}
                            >
                                {saving ? 'Создание…' : 'Создать'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isUserOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        resetUserModalState();
                    } else {
                        setIsUserOpen(true);
                    }
                }}
            >
                <DialogContent className={dialogStyles.dialogContent}>
                    <DialogHeader className={dialogStyles.dialogHeader}>
                        <DialogTitle className={dialogStyles.dialogTitle}>Пользователь</DialogTitle>
                        <DialogDescription className={dialogStyles.dialogDescription}>
                            {selectedUser
                                ? `${selectedUser.fio || '—'} (${selectedUser.position || '—'}) — user #${selectedUser.user_id}`
                                : '—'}
                        </DialogDescription>
                    </DialogHeader>

                    {!selectedUser ? null : (
                        <div className={dialogStyles.dialogBody}>
                            <SegmentedTabs
                                value={userTab}
                                ariaLabel="Вкладки пользователя"
                                onChange={(value) => setUserTab(value)}
                                items={[
                                    { value: 'roles', label: 'Роли' },
                                    { value: 'permissions', label: 'Права' },
                                    { value: 'password', label: 'Пароль' },
                                ]}
                            />

                            {userTab === 'roles' ? (
                                <div className={dialogStyles.tabPanel}>
                                    <div className={pageStyles.sectionLead}>
                                        <div className={pageStyles.sectionTitle}>Роли пользователя</div>
                                        <div className={pageStyles.sectionText}>
                                            Отметьте роли, которые должны быть у выбранного сотрудника.
                                        </div>
                                    </div>

                                    <div className={sharedStyles.roleList}>
                                        {roles.length === 0 ? (
                                            <div className={sharedStyles.stateCard}>Ролей нет</div>
                                        ) : (
                                            roles.map((role) => {
                                                const roleId = Number(role.id);
                                                const checked = selectedUserRoleIds.has(roleId);
                                                const permissionCount = permissionIdsByRoleId.get(roleId)?.size ?? 0;
                                                const positionNormalized = String(selectedUser?.position || '').trim().toLowerCase();
                                                const isMainDirector = positionNormalized === 'главный директор';
                                                const isDirectorRoleLocked = isMainDirector && role.key === 'director';
                                                const isLastRole = checked && selectedUserRoleIds.size <= 1;
                                                const disableUncheck = saving || isDirectorRoleLocked || isLastRole;

                                                const toggleRole = () => {
                                                    if (saving) return;
                                                    const nextValue = !checked;

                                                    if (!nextValue) {
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
                                                    void (nextValue ? addRole(roleId) : removeRole(roleId));
                                                };

                                                return (
                                                    <div
                                                        key={role.id}
                                                        className={`${sharedStyles.roleCard} ${sharedStyles.roleCardClickable} ${checked ? sharedStyles.roleCardSelected : ''}`}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={toggleRole}
                                                        onKeyDown={(event) => {
                                                            if (event.key !== 'Enter' && event.key !== ' ') return;
                                                            event.preventDefault();
                                                            toggleRole();
                                                        }}
                                                    >
                                                        <div className={sharedStyles.roleCardHeader}>
                                                            <div className={sharedStyles.roleCardTitleRow}>
                                                                <span
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onKeyDown={(event) => event.stopPropagation()}
                                                                >
                                                                    <Checkbox
                                                                        checked={checked}
                                                                        className={sharedStyles.checkbox}
                                                                        disabled={disableUncheck}
                                                                        onCheckedChange={(value) => {
                                                                            if (saving) return;

                                                                            const nextValue = value === true;
                                                                            if (!nextValue) {
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
                                                                            void (nextValue ? addRole(roleId) : removeRole(roleId));
                                                                        }}
                                                                    />
                                                                </span>

                                                                <div className={sharedStyles.roleCardTitleText}>
                                                                    <div className={sharedStyles.roleCardName}>
                                                                        {role.name || role.key}
                                                                    </div>
                                                                    <div className={sharedStyles.mono}>{role.key}</div>
                                                                </div>
                                                            </div>

                                                            <Badge variant="outline">{permissionCount} прав</Badge>
                                                        </div>

                                                        {role.description ? (
                                                            <div className={sharedStyles.roleCardDesc}>{role.description}</div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {userTab === 'permissions' ? (
                                <div className={dialogStyles.tabPanel}>
                                    <div className={pageStyles.permissionsHeader}>
                                        <div className={pageStyles.sectionLead}>
                                            <div className={pageStyles.sectionTitle}>Права пользователя</div>
                                            <div className={pageStyles.sectionText}>
                                                По умолчанию права наследуются от ролей. Здесь можно переопределить их: разрешить, запретить или вернуть наследование.
                                            </div>
                                        </div>

                                        <DataSearchField
                                            wrapperClassName={pageStyles.permissionsSearch}
                                            value={permissionQuery}
                                            onValueChange={setPermissionQuery}
                                            placeholder="Поиск по правам…"
                                        />
                                    </div>

                                    {isDirectorUser ? (
                                        <div className={dialogStyles.hintCard}>
                                            Для пользователя с ролью director ручное редактирование прав отключено.
                                        </div>
                                    ) : null}

                                    <div>
                                        {filteredPermissions.length === 0 ? (
                                            <div className={sharedStyles.stateCard}>Права не найдены</div>
                                        ) : (
                                            <div className={sharedStyles.permSections}>
                                                <div className={sharedStyles.permSection}>
                                                    <div className={sharedStyles.permSectionHeader}>
                                                        <div className={pageStyles.sectionTitle}>Доступ к страницам</div>
                                                        <Badge variant="outline">{permissionGroups.pages.length}</Badge>
                                                    </div>

                                                    <div className={sharedStyles.permList}>
                                                        {permissionGroups.pages.map((permission) => {
                                                            const permissionId = Number(permission.id);
                                                            const override = userPermissionOverrideByPermissionId.get(permissionId);
                                                            const inherited = inheritedPermissionIds.has(permissionId);
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
                                                                void setUserPermission(permissionId, next);
                                                            };

                                                            return (
                                                                <div
                                                                    key={permission.id}
                                                                    className={`${sharedStyles.permCard} ${fromRole ? sharedStyles.permCardAllowed : ''} ${override ? sharedStyles.permCardOverride : ''} ${override?.effect === 'allow' ? sharedStyles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? sharedStyles.permCardOverrideDeny : ''} ${interactive ? sharedStyles.permCardInteractive : ''}`}
                                                                    role={interactive ? 'button' : undefined}
                                                                    tabIndex={interactive ? 0 : -1}
                                                                    onClick={cycleMode}
                                                                    onKeyDown={(event) => {
                                                                        if (!interactive) return;
                                                                        if (event.key !== 'Enter' && event.key !== ' ') return;
                                                                        event.preventDefault();
                                                                        cycleMode();
                                                                    }}
                                                                >
                                                                    <div className={sharedStyles.permCardHeader}>
                                                                        <div className={sharedStyles.permCardTitleRow}>
                                                                            <Checkbox checked={effectiveAllowed} disabled className={sharedStyles.checkbox} />
                                                                            <div className={sharedStyles.permCardTitleText}>
                                                                                <div className={sharedStyles.permCardTitle}>
                                                                                    {permission.name || permission.key}
                                                                                </div>
                                                                                <div className={sharedStyles.permKeyText}>{permission.key}</div>
                                                                            </div>
                                                                        </div>
                                                                        {badgeText ? <span className={sharedStyles.permBadge}>{badgeText}</span> : null}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className={sharedStyles.permSection}>
                                                    <div className={sharedStyles.permSectionHeader}>
                                                        <div className={pageStyles.sectionTitle}>Действия на страницах</div>
                                                        <Badge variant="outline">
                                                            {permissionGroups.actionSections.reduce((accumulator, section) => accumulator + section.items.length, 0)}
                                                        </Badge>
                                                    </div>

                                                    {permissionGroups.actionSections.map((section) => (
                                                        <div key={section.pageKey} className={sharedStyles.permSubSection}>
                                                            <div className={pageStyles.sectionSubTitle}>
                                                                {getPermissionModuleLabel(section.pageKey)}
                                                            </div>

                                                            <div className={sharedStyles.permList}>
                                                                {section.items.map((permission) => {
                                                                    const permissionId = Number(permission.id);
                                                                    const override = userPermissionOverrideByPermissionId.get(permissionId);
                                                                    const inherited = inheritedPermissionIds.has(permissionId);
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
                                                                        void setUserPermission(permissionId, next);
                                                                    };

                                                                    return (
                                                                        <div
                                                                            key={permission.id}
                                                                            className={`${sharedStyles.permCard} ${fromRole ? sharedStyles.permCardAllowed : ''} ${override ? sharedStyles.permCardOverride : ''} ${override?.effect === 'allow' ? sharedStyles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? sharedStyles.permCardOverrideDeny : ''} ${interactive ? sharedStyles.permCardInteractive : ''}`}
                                                                            role={interactive ? 'button' : undefined}
                                                                            tabIndex={interactive ? 0 : -1}
                                                                            onClick={cycleMode}
                                                                            onKeyDown={(event) => {
                                                                                if (!interactive) return;
                                                                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                                                                event.preventDefault();
                                                                                cycleMode();
                                                                            }}
                                                                        >
                                                                            <div className={sharedStyles.permCardHeader}>
                                                                                <div className={sharedStyles.permCardTitleRow}>
                                                                                    <Checkbox checked={effectiveAllowed} disabled className={sharedStyles.checkbox} />
                                                                                    <div className={sharedStyles.permCardTitleText}>
                                                                                        <div className={sharedStyles.permCardTitle}>
                                                                                            {permission.name || permission.key}
                                                                                        </div>
                                                                                        <div className={sharedStyles.permKeyText}>{permission.key}</div>
                                                                                    </div>
                                                                                </div>
                                                                                {badgeText ? <span className={sharedStyles.permBadge}>{badgeText}</span> : null}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className={sharedStyles.permSection}>
                                                    <div className={sharedStyles.permSectionHeader}>
                                                        <div className={pageStyles.sectionTitle}>Специальные права</div>
                                                        <Badge variant="outline">{permissionGroups.special.length}</Badge>
                                                    </div>

                                                    <div className={sharedStyles.permList}>
                                                        {permissionGroups.special.map((permission) => {
                                                            const permissionId = Number(permission.id);
                                                            const override = userPermissionOverrideByPermissionId.get(permissionId);
                                                            const inherited = inheritedPermissionIds.has(permissionId);
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
                                                                void setUserPermission(permissionId, next);
                                                            };

                                                            return (
                                                                <div
                                                                    key={permission.id}
                                                                    className={`${sharedStyles.permCard} ${fromRole ? sharedStyles.permCardAllowed : ''} ${override ? sharedStyles.permCardOverride : ''} ${override?.effect === 'allow' ? sharedStyles.permCardOverrideAllow : ''} ${override?.effect === 'deny' ? sharedStyles.permCardOverrideDeny : ''} ${interactive ? sharedStyles.permCardInteractive : ''}`}
                                                                    role={interactive ? 'button' : undefined}
                                                                    tabIndex={interactive ? 0 : -1}
                                                                    onClick={cycleMode}
                                                                    onKeyDown={(event) => {
                                                                        if (!interactive) return;
                                                                        if (event.key !== 'Enter' && event.key !== ' ') return;
                                                                        event.preventDefault();
                                                                        cycleMode();
                                                                    }}
                                                                >
                                                                    <div className={sharedStyles.permCardHeader}>
                                                                        <div className={sharedStyles.permCardTitleRow}>
                                                                            <Checkbox checked={effectiveAllowed} disabled className={sharedStyles.checkbox} />
                                                                            <div className={sharedStyles.permCardTitleText}>
                                                                                <div className={sharedStyles.permCardTitle}>
                                                                                    {permission.name || permission.key}
                                                                                </div>
                                                                                <div className={sharedStyles.permKeyText}>{permission.key}</div>
                                                                            </div>
                                                                        </div>
                                                                        {badgeText ? <span className={sharedStyles.permBadge}>{badgeText}</span> : null}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {userTab === 'password' ? (
                                <div className={dialogStyles.tabPanel}>
                                    <div className={pageStyles.autofillTrap} aria-hidden="true">
                                        <input
                                            tabIndex={-1}
                                            name="rbac_username"
                                            type="text"
                                            autoComplete="username"
                                            defaultValue=""
                                        />
                                        <input
                                            tabIndex={-1}
                                            name="rbac_new_password_dummy"
                                            type="password"
                                            autoComplete="new-password"
                                            defaultValue=""
                                        />
                                    </div>

                                    <div className={pageStyles.sectionLead}>
                                        <div className={pageStyles.sectionTitle}>Управление паролем</div>
                                        <div className={pageStyles.sectionText}>
                                            Текущий пароль нельзя посмотреть: в системе хранится только его хеш. Можно сразу задать новый пароль.
                                        </div>
                                    </div>

                                    <div className={dialogStyles.hintCard}>
                                        Для безопасности мы не храним текущий пароль в открытом виде, поэтому можно только установить новый.
                                    </div>

                                    <label className={dialogStyles.field}>
                                        <span className={dialogStyles.fieldLabel}>Введите новый пароль</span>
                                        <div className={dialogStyles.passwordField}>
                                            <Lock className={pageStyles.passwordIcon} />
                                            <Input
                                                id="admin-user-password"
                                                className={`${dialogStyles.input} ${dialogStyles.passwordInput} ${pageStyles.passwordInputWithIcon}`}
                                                type={showResetPassword ? 'text' : 'password'}
                                                name="admin_user_new_password"
                                                autoComplete="new-password"
                                                autoCorrect="off"
                                                autoCapitalize="none"
                                                spellCheck={false}
                                                data-lpignore="true"
                                                data-1p-ignore="true"
                                                data-bwignore="true"
                                                value={resetPassword}
                                                onChange={(event) => {
                                                    setResetPassword(event.target.value);
                                                    if (passwordFormError) setPasswordFormError(null);
                                                    if (resetResultPassword) setResetResultPassword(null);
                                                }}
                                                placeholder="Введите новый пароль"
                                            />
                                            <button
                                                type="button"
                                                aria-label={showResetPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                onClick={() => setShowResetPassword((value) => !value)}
                                                className={dialogStyles.passwordToggle}
                                            >
                                                {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </label>

                                    <label className={dialogStyles.field}>
                                        <span className={dialogStyles.fieldLabel}>Повторите новый пароль</span>
                                        <div className={dialogStyles.passwordField}>
                                            <Lock className={pageStyles.passwordIcon} />
                                            <Input
                                                id="admin-user-password-repeat"
                                                className={`${dialogStyles.input} ${dialogStyles.passwordInput} ${pageStyles.passwordInputWithIcon}`}
                                                type={showResetPasswordRepeat ? 'text' : 'password'}
                                                name="admin_user_new_password_repeat"
                                                autoComplete="new-password"
                                                autoCorrect="off"
                                                autoCapitalize="none"
                                                spellCheck={false}
                                                data-lpignore="true"
                                                data-1p-ignore="true"
                                                data-bwignore="true"
                                                value={resetPasswordRepeat}
                                                onChange={(event) => {
                                                    setResetPasswordRepeat(event.target.value);
                                                    if (passwordFormError) setPasswordFormError(null);
                                                    if (resetResultPassword) setResetResultPassword(null);
                                                }}
                                                placeholder="Повторите новый пароль"
                                            />
                                            <button
                                                type="button"
                                                aria-label={showResetPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                                                onClick={() => setShowResetPasswordRepeat((value) => !value)}
                                                className={dialogStyles.passwordToggle}
                                            >
                                                {showResetPasswordRepeat ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </label>

                                    {passwordFormError ? (
                                        <div className={dialogStyles.error}>{passwordFormError}</div>
                                    ) : null}

                                    {resetResultPassword ? (
                                        <div className={dialogStyles.success}>Пароль успешно обновлен.</div>
                                    ) : null}

                                    <div className={dialogStyles.actions}>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={dialogStyles.secondaryButton}
                                            onClick={resetUserModalState}
                                            disabled={saving}
                                        >
                                            Закрыть
                                        </Button>
                                        <Button
                                            type="button"
                                            className={dialogStyles.primaryButton}
                                            onClick={() => void doResetPassword()}
                                            disabled={saving}
                                        >
                                            {saving ? 'Смена…' : 'Сменить пароль'}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            {userTab !== 'password' ? (
                                <div className={dialogStyles.actions}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={dialogStyles.secondaryButton}
                                        onClick={resetUserModalState}
                                        disabled={saving}
                                    >
                                        Закрыть
                                    </Button>
                                </div>
                            ) : null}

                            {error ? <div className={dialogStyles.error}>{error}</div> : null}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
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
                <DialogContent className={`${dialogStyles.dialogContent} ${dialogStyles.dialogContentWide} ${pageStyles.rbacDialogContent}`}>
                    <DialogHeader className={dialogStyles.dialogHeader}>
                        <DialogTitle className={dialogStyles.dialogTitle}>Настройки RBAC</DialogTitle>
                        <DialogDescription className={dialogStyles.dialogDescription}>
                            Роли, права и права ролей. Для обычной работы выдавайте доступ через карточку пользователя.
                        </DialogDescription>
                    </DialogHeader>

                    <div className={dialogStyles.dialogBody}>
                        <SegmentedTabs
                            value={rbacTab}
                            ariaLabel="Настройки RBAC"
                            onChange={(value) => setRbacTab(value)}
                            items={[
                                { value: 'roles', label: 'Роли' },
                                { value: 'permissions', label: 'Права' },
                                { value: 'role-permissions', label: 'Права ролей' },
                            ]}
                        />

                        <div className={pageStyles.rbacDialogBody}>
                            {rbacTab === 'roles' ? (
                                <RolesAdmin embedded />
                            ) : rbacTab === 'permissions' ? (
                                <PermissionsAdmin embedded />
                            ) : (
                                <RolePermissionsAdmin embedded onChanged={fetchAll} />
                            )}
                        </div>

                        <div className={dialogStyles.actions}>
                            <Button
                                type="button"
                                variant="outline"
                                className={dialogStyles.secondaryButton}
                                onClick={() => {
                                    setIsRbacOpen(false);
                                    setRbacTab('roles');
                                    void fetchAll();
                                }}
                            >
                                Закрыть
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );

    if (embedded) {
        return <div>{content}</div>;
    }

    return <div className={pageStyles.container}>{content}</div>;
}
