import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Checkbox, Flex, Text, TextField } from '@radix-ui/themes';
import styles from '../../pages/admin/AdminRbac.module.css';

type RoleItem = {
    id: number;
    key: string;
    name?: string | null;
    description?: string | null;
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

function getPermissionModuleLabel(groupKey: string): string {
    return PERMISSION_MODULE_LABELS.get(groupKey) || groupKey || 'Прочее';
}

export function RolePermissionsAdmin({ embedded, onChanged }: { embedded?: boolean; onChanged?: () => void }): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [perms, setPerms] = useState<PermissionItem[]>([]);
    const [links, setLinks] = useState<RolePermissionLink[]>([]);

    const [q, setQ] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
        try {
            setError(null);
            if (!opts?.silent) setLoading(true);

            const [rRes, pRes, lRes] = await Promise.all([
                fetch('/api/admin/roles'),
                fetch('/api/admin/permissions'),
                fetch('/api/admin/role-permissions'),
            ]);

            const rJson = (await rRes.json().catch(() => ({}))) as any;
            const pJson = (await pRes.json().catch(() => ({}))) as any;
            const lJson = (await lRes.json().catch(() => ({}))) as any;

            if (!rRes.ok) throw new Error(rJson?.error || 'Ошибка');
            if (!pRes.ok) throw new Error(pJson?.error || 'Ошибка');
            if (!lRes.ok) throw new Error(lJson?.error || 'Ошибка');

            setRoles(Array.isArray(rJson?.items) ? rJson.items : []);
            setPerms(Array.isArray(pJson?.items) ? pJson.items : []);
            setLinks(Array.isArray(lJson?.items) ? lJson.items : []);
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const permsById = useMemo(() => {
        const m = new Map<number, PermissionItem>();
        for (const p of perms) m.set(Number(p.id), p);
        return m;
    }, [perms]);

    const permIdsByRoleId = useMemo(() => {
        const m = new Map<number, Set<number>>();
        for (const l of links) {
            const rid = Number((l as any).role_id);
            const pid = Number((l as any).permission_id);
            const set = m.get(rid) || new Set<number>();
            set.add(pid);
            m.set(rid, set);
        }
        return m;
    }, [links]);

    const filteredRoles = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return roles;
        return roles.filter((r) => {
            const ids = permIdsByRoleId.get(Number(r.id));
            const permKeys = ids ? Array.from(ids).map((id) => permsById.get(id)?.key || '').join(', ').toLowerCase() : '';
            return (
                String(r.id).includes(s) ||
                String(r.key || '').toLowerCase().includes(s) ||
                String(r.name || '').toLowerCase().includes(s) ||
                permKeys.includes(s)
            );
        });
    }, [permsById, permIdsByRoleId, q, roles]);

    const selectedPermIds = useMemo(() => {
        if (!selectedRole) return new Set<number>();
        return permIdsByRoleId.get(Number(selectedRole.id)) || new Set<number>();
    }, [permIdsByRoleId, selectedRole]);

    const selectedRoleKey = String(selectedRole?.key || '').trim().toLowerCase();
    const isDirector = selectedRoleKey === 'director';
    const selectedPermIdsEffective = useMemo(() => {
        if (!selectedRole) return new Set<number>();
        if (isDirector) return new Set<number>(perms.map((p) => Number(p.id)));
        return selectedPermIds;
    }, [isDirector, perms, selectedPermIds, selectedRole]);

    useEffect(() => {
        if (selectedRole) return;
        if (roles.length === 0) return;
        const director = roles.find((r) => String(r.key || '').trim().toLowerCase() === 'director');
        setSelectedRole(director || roles[0]);
    }, [roles, selectedRole]);

    const filteredPerms = useMemo(() => {
        const s = q.trim().toLowerCase();
        const base = perms.slice().sort((a, b) => Number(a.id) - Number(b.id));
        if (!s) return base;
        return base.filter((p) => {
            return String(p.key || '').toLowerCase().includes(s) || String(p.name || '').toLowerCase().includes(s);
        });
    }, [perms, q]);

    const permissionGroups = useMemo(() => {
        const groups = new Map<string, PermissionItem[]>();

        for (const p of filteredPerms) {
            const normalized = normalizePermissionKeyForGrouping(String(p.key || ''));
            const groupKey = normalized.groupKey || 'other';
            const arr = groups.get(groupKey) || [];
            arr.push(p);
            groups.set(groupKey, arr);
        }

        return Array.from(groups.entries())
            .map(([groupKey, items]) => ({
                groupKey,
                label: getPermissionModuleLabel(groupKey),
                items: items.slice().sort(permKeyCompare),
            }))
            .sort((a, b) => {
                const aOrder = PERMISSION_MODULE_ORDER.get(a.groupKey) ?? Number.MAX_SAFE_INTEGER;
                const bOrder = PERMISSION_MODULE_ORDER.get(b.groupKey) ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a.label.localeCompare(b.label, 'ru');
            });
    }, [filteredPerms]);

    useEffect(() => {
        setExpandedGroups((prev) => {
            const next: Record<string, boolean> = {};
            for (const group of permissionGroups) {
                if (Object.prototype.hasOwnProperty.call(prev, group.groupKey)) {
                    next[group.groupKey] = prev[group.groupKey];
                    continue;
                }
                next[group.groupKey] = q.trim().length > 0;
            }
            return next;
        });
    }, [permissionGroups, q]);

    const toggleGroupExpanded = useCallback((groupKey: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupKey]: !prev[groupKey],
        }));
    }, []);

    const toggle = async (permissionId: number) => {
        if (!selectedRole) return;
        const roleId = Number(selectedRole.id);
        const has = selectedPermIdsEffective.has(permissionId);

        if (isDirector) return;

        try {
            setSaving(true);
            if (!has) {
                const res = await fetch('/api/admin/role-permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roleId, permissionId }),
                });
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');

                setLinks((prev) => {
                    const next = prev.slice();
                    next.push({ role_id: roleId, permission_id: permissionId });
                    return next;
                });
            } else {
                const res = await fetch(
                    `/api/admin/role-permissions?roleId=${encodeURIComponent(String(roleId))}&permissionId=${encodeURIComponent(String(permissionId))}`,
                    { method: 'DELETE' }
                );
                const json = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(json?.error || 'Ошибка');

                setLinks((prev) => prev.filter((l) => !(Number((l as any).role_id) === roleId && Number((l as any).permission_id) === permissionId)));
            }
            void fetchAll({ silent: true });
            onChanged?.();
        } catch (e) {
            setError((e as any)?.message || 'Ошибка');
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Права ролей</h1>
                        <div className={styles.subtitle}>Выдача/отзыв прав ролям (доступ: director)</div>
                    </div>
                    <div className={styles.actions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={() => void fetchAll()}
                            className={styles.surfaceButton}
                        >
                            Обновить
                        </Button>
                    </div>
                </div>
                <div style={{ marginTop: 12 }}>
                    <TextField.Root value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по роли/праву…" />
                </div>
            </div>

            {error ? (
                <Box p="4">
                    <Text color="red">{error}</Text>
                </Box>
            ) : null}

            {loading ? (
                <div className={styles.card} style={{ padding: 16 }}>
                    <Text>Загрузка…</Text>
                </div>
            ) : filteredRoles.length === 0 ? (
                <div className={styles.card} style={{ padding: 16 }}>
                    <Text>Пусто</Text>
                </div>
            ) : (
                <div className={styles.rpSplit}>
                    <div className={styles.rpRolesCol}>
                        <div className={styles.roleList}>
                            {filteredRoles
                                .slice()
                                .sort((a, b) => Number(a.id) - Number(b.id))
                                .map((r) => {
                                    const rid = Number(r.id);
                                    const ids = permIdsByRoleId.get(rid) || new Set<number>();
                                    const selected = selectedRole ? Number(selectedRole.id) === rid : false;
                                    const roleName = r.name || r.key;
                                    const count = String(r.key || '').trim().toLowerCase() === 'director' ? perms.length : ids.size;

                                    return (
                                        <div
                                            key={r.id}
                                            className={`${styles.roleCard} ${selected ? styles.roleCardSelected : ''}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedRole(r)}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter' && e.key !== ' ') return;
                                                e.preventDefault();
                                                setSelectedRole(r);
                                            }}
                                        >
                                            <div className={styles.roleCardHeader}>
                                                <div>
                                                    <Text weight="medium" size="4">
                                                        {roleName}
                                                    </Text>
                                                    <div className={styles.mono} style={{ marginTop: 4 }}>
                                                        {r.key}
                                                    </div>
                                                </div>
                                                <Badge color="gray" variant="surface" highContrast>
                                                    {count}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className={styles.rpPermsCol}>
                        <div className={styles.rpPermsHeader}>
                            <Text weight="medium" size="4">
                                {selectedRole ? `Права роли "${selectedRole.name || selectedRole.key}"` : 'Права роли'}
                            </Text>
                            {isDirector ? (
                                <Text size="2" color="gray">
                                    У роли director все права выданы и не могут быть отозваны.
                                </Text>
                            ) : (
                                <Text size="2" color="gray">
                                    Отметьте права, которые должны быть выданы роли.
                                </Text>
                            )}
                        </div>

                        <div className={styles.rpPermsList}>
                            {permissionGroups.length === 0 ? (
                                <div className={styles.card} style={{ padding: 16 }}>
                                    <Text>По вашему запросу права не найдены.</Text>
                                </div>
                            ) : (
                                <div className={styles.permSections}>
                                    {permissionGroups.map((group) => {
                                        const expanded = expandedGroups[group.groupKey] ?? false;
                                        const total = group.items.length;
                                        const selectedCount = group.items.reduce((acc, p) => acc + (selectedPermIdsEffective.has(Number(p.id)) ? 1 : 0), 0);

                                        return (
                                            <div key={group.groupKey} className={styles.permGroupCard}>
                                                <button
                                                    type="button"
                                                    className={styles.permGroupToggle}
                                                    onClick={() => toggleGroupExpanded(group.groupKey)}
                                                >
                                                    <div className={styles.permGroupToggleLeft}>
                                                        <Text weight="medium" size="4">
                                                            {group.label}
                                                        </Text>
                                                        <Text size="2" color="gray">
                                                            {expanded ? 'Скрыть права' : 'Показать права'}
                                                        </Text>
                                                    </div>
                                                    <div className={styles.permGroupToggleRight}>
                                                        <Badge color="gray" variant="surface" highContrast>
                                                            {selectedCount}/{total}
                                                        </Badge>
                                                        <span className={`${styles.permGroupChevron} ${expanded ? styles.permGroupChevronOpen : ''}`} aria-hidden="true">
                                                            ▾
                                                        </span>
                                                    </div>
                                                </button>

                                                {!expanded ? null : (
                                                    <div className={styles.permList}>
                                                        {group.items.map((p) => {
                                                            const pid = Number(p.id);
                                                            const checked = selectedPermIdsEffective.has(pid);
                                                            const disabled = saving || !selectedRole || isDirector;
                                                            const toggleRow = () => {
                                                                if (!selectedRole) return;
                                                                if (saving) return;
                                                                if (isDirector) return;
                                                                void toggle(pid);
                                                            };

                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    className={`${styles.permCard} ${styles.permCardInteractive}`}
                                                                    role={disabled ? undefined : 'button'}
                                                                    tabIndex={disabled ? -1 : 0}
                                                                    onClick={disabled ? undefined : toggleRow}
                                                                    onKeyDown={(e) => {
                                                                        if (disabled) return;
                                                                        if (e.key !== 'Enter' && e.key !== ' ') return;
                                                                        e.preventDefault();
                                                                        toggleRow();
                                                                    }}
                                                                >
                                                                    <div className={styles.permCardHeader}>
                                                                        <div className={styles.permCardTitleRow}>
                                                                            <div
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                            >
                                                                                <Checkbox
                                                                                    checked={checked}
                                                                                    disabled={disabled}
                                                                                    className={styles.rpCheckbox}
                                                                                    onCheckedChange={() => {
                                                                                        if (disabled) return;
                                                                                        toggleRow();
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Text weight="medium">{p.name || p.key}</Text>
                                                                                <Text size="2" color="gray" className={styles.permKeyText}>
                                                                                    {p.key}
                                                                                </Text>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    if (embedded) return <div>{content}</div>;

    return <div className={styles.container}>{content}</div>;
}
