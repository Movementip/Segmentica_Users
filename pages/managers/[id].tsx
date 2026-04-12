import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './ManagerDetail.module.css';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, Flex, Grid, Heading, Select, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiArrowLeft, FiDownload, FiRefreshCw, FiSave, FiShield, FiUser } from 'react-icons/fi';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { ManagerHrWorkspace } from '../../components/ManagerHrWorkspace';
import { EmployeeSchedulePanel } from '../../components/EmployeeSchedulePanel';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';

interface ManagerDetail {
    id: number;
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен: boolean;
    created_at: string;
}

interface AttachmentItem {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
}

type ProfilePermission = {
    key: string;
    name: string | null;
    description: string | null;
};

type PayrollItem = {
    id: string;
    date: string;
    amount: number;
    type: string | null;
    status: string | null;
    relatedOrderId: number | null;
};

type ProfilePayload = {
    profile: {
        id: number;
        userId: number;
        fio: string;
        position: string | null;
        phone: string | null;
        email: string | null;
        rate: number | null;
        hireDate: string | null;
        isActive: boolean;
        createdAt: string | null;
    };
    roles: string[];
    permissions: ProfilePermission[];
    payroll: {
        available: boolean;
        monthsRequested: number;
        totalPaid: number;
        paymentCount: number;
        latestPaymentDate: string | null;
        items: PayrollItem[];
    };
};

type ProfileTab = 'profile' | 'permissions' | 'salary' | 'schedule' | 'password';

const PROFILE_TABS: ProfileTab[] = ['profile', 'permissions', 'salary', 'schedule', 'password'];

const isProfileTab = (value: string | undefined): value is ProfileTab => {
    return Boolean(value && PROFILE_TABS.includes(value as ProfileTab));
};

const PROFILE_PERMISSION_LABELS = new Map<string, string>([
    ['dashboard', 'Дашборд'],
    ['reports', 'Отчеты'],
    ['orders', 'Заявки'],
    ['clients', 'Контрагенты'],
    ['purchases', 'Закупки'],
    ['warehouse', 'Склад'],
    ['products', 'Товары'],
    ['categories', 'Категории'],
    ['missing_products', 'Недостающие товары'],
    ['suppliers', 'Поставщики'],
    ['transport', 'ТК'],
    ['shipments', 'Отгрузки'],
    ['managers', 'Сотрудники'],
    ['archive', 'Архив'],
    ['admin', 'Администрирование'],
    ['other', 'Прочее'],
]);

const formatIsoDateKey = (value: Date): string => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMonthKey = (value: Date): string => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
};

const formatMonthTitle = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return monthKey;
    }
    return new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
};

const getPermissionGroupLabel = (permissionKey: string): string => {
    const prefix = String(permissionKey || '').split('.')[0] || 'other';
    return PROFILE_PERMISSION_LABELS.get(prefix) || prefix;
};

function ManagerDetailPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { id } = router.query;
    const [manager, setManager] = useState<ManagerDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
    const [profileForm, setProfileForm] = useState({ fio: '', phone: '', email: '' });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [profileMessageType, setProfileMessageType] = useState<'success' | 'error'>('success');
    const [passwordForm, setPasswordForm] = useState({ next: '', repeat: '' });
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
    const [profilePermissions, setProfilePermissions] = useState<ProfilePermission[]>([]);
    const [profileRoles, setProfileRoles] = useState<string[]>([]);
    const [payrollData, setPayrollData] = useState<ProfilePayload['payroll'] | null>(null);
    const [payrollMonths, setPayrollMonths] = useState<string>('6');
    const [calendarMonth, setCalendarMonth] = useState<string>('');

    const managerId = Number(Array.isArray(id) ? id[0] : id);
    const isOwnProfile = Boolean(user?.employee?.id && Number.isInteger(managerId) && managerId > 0 && managerId === Number(user.employee.id));
    const canView = Boolean(user?.permissions?.includes('managers.view'));
    const canEdit = Boolean(user?.permissions?.includes('managers.edit'));
    const canDelete = Boolean(user?.permissions?.includes('managers.delete'));
    const canScheduleManage = Boolean(user?.permissions?.includes('schedule.manage') || user?.permissions?.includes('managers.edit'));
    const canSelfScheduleEdit = Boolean(isOwnProfile && (user?.permissions?.includes('schedule.self.edit') || canScheduleManage));
    const canSelfScheduleApplyPattern = Boolean(isOwnProfile && (user?.permissions?.includes('schedule.self.apply_pattern') || canScheduleManage));

    const canAttachmentsView = Boolean(user?.permissions?.includes('managers.attachments.view'));
    const canAttachmentsUpload = Boolean(user?.permissions?.includes('managers.attachments.upload'));
    const canAttachmentsDelete = Boolean(user?.permissions?.includes('managers.attachments.delete'));
    const rawMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode;
    const profileTab = isProfileTab(rawMode) ? rawMode : 'profile';
    const isSelfProfileMode = isOwnProfile && (!canView || isProfileTab(rawMode));
    const canAccessPage = canView || isOwnProfile;

    const fetchAttachments = useCallback(async (managerId: number) => {
        if (!Number.isInteger(managerId) || managerId <= 0) {
            setAttachments([]);
            return;
        }
        try {
            setAttachmentsLoading(true);
            setAttachmentsError(null);

            if (!canAttachmentsView) {
                setAttachments([]);
                return;
            }

            const res = await fetch(`/api/attachments?entity_type=manager&entity_id=${encodeURIComponent(String(managerId))}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Ошибка загрузки вложений');
            }
            const data = (await res.json()) as AttachmentItem[];
            setAttachments(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки вложений');
        } finally {
            setAttachmentsLoading(false);
        }
    }, [canAttachmentsView]);

    const fetchOwnProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/profile?months=${encodeURIComponent(payrollMonths)}`);
            const data = (await response.json().catch(() => ({}))) as ProfilePayload | { error?: string };

            if (!response.ok) {
                throw new Error((data as { error?: string })?.error || 'Ошибка загрузки профиля');
            }

            const payload = data as ProfilePayload;
            setManager({
                id: payload.profile.id,
                фио: payload.profile.fio,
                должность: payload.profile.position || '',
                телефон: payload.profile.phone || undefined,
                email: payload.profile.email || undefined,
                ставка: payload.profile.rate || undefined,
                дата_приема: payload.profile.hireDate || undefined,
                активен: payload.profile.isActive,
                created_at: payload.profile.createdAt || '',
            });
            setProfileForm({
                fio: payload.profile.fio || '',
                phone: payload.profile.phone || '',
                email: payload.profile.email || '',
            });
            setProfileRoles(Array.isArray(payload.roles) ? payload.roles : []);
            setProfilePermissions(Array.isArray(payload.permissions) ? payload.permissions : []);
            setPayrollData(payload.payroll);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки профиля');
        } finally {
            setLoading(false);
        }
    }, [payrollMonths]);

    const fetchManagerDetail = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/managers?id=${id}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки сотрудника');
            }

            const data = await response.json();
            setManager(data);

            if (data?.id) {
                if (canAttachmentsView) {
                    await fetchAttachments(Number(data.id));
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [canAttachmentsView, fetchAttachments, id]);

    const refreshBaseData = useCallback(async () => {
        if (isOwnProfile && !canView) {
            await fetchOwnProfile();
            return;
        }
        await fetchManagerDetail();
    }, [canView, fetchManagerDetail, fetchOwnProfile, isOwnProfile]);

    const canPreviewInline = (a: AttachmentItem) => {
        const mime = (a.mime_type || '').toLowerCase();
        const name = (a.filename || '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return true;
        if (mime.startsWith('image/')) return true;
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return true;
        return false;
    };

    const openPreview = (a: AttachmentItem) => {
        if (!canAttachmentsView) {
            setAttachmentsError('Нет доступа');
            return;
        }

        if (!canPreviewInline(a)) {
            window.open(`/api/attachments/${encodeURIComponent(a.id)}/download`, '_blank', 'noopener,noreferrer');
            return;
        }
        setPreviewAttachment(a);
        setIsPreviewOpen(true);
    };

    const handleUploadAttachment = useCallback(async (file: File) => {
        if (!canAttachmentsUpload) {
            setAttachmentsError('Нет доступа');
            return;
        }

        const managerId = Number(manager?.id);
        if (!Number.isInteger(managerId) || managerId <= 0) return;

        try {
            setAttachmentsUploading(true);
            setAttachmentsError(null);

            const form = new FormData();
            form.append('file', file);
            form.append('entity_type', 'manager');
            form.append('entity_id', String(managerId));

            const res = await fetch('/api/attachments', { method: 'POST', body: form });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка загрузки файла');
            }

            await fetchAttachments(managerId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
        } finally {
            setAttachmentsUploading(false);
        }
    }, [canAttachmentsUpload, fetchAttachments, manager?.id]);

    const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
        if (!canAttachmentsDelete) {
            setAttachmentsError('Нет доступа');
            return;
        }

        const managerId = Number(manager?.id);
        if (!Number.isInteger(managerId) || managerId <= 0) return;

        try {
            setAttachmentsError(null);
            const res = await fetch(
                `/api/attachments/${encodeURIComponent(attachmentId)}?entity_type=manager&entity_id=${encodeURIComponent(String(managerId))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || 'Ошибка удаления вложения');
            }
            await fetchAttachments(managerId);
        } catch (e) {
            console.error(e);
            setAttachmentsError(e instanceof Error ? e.message : 'Ошибка удаления вложения');
        }
    }, [canAttachmentsDelete, fetchAttachments, manager?.id]);

    const handleProfileTabChange = useCallback(async (value: string) => {
        if (!isProfileTab(value)) return;
        await router.replace(
            {
                pathname: router.pathname,
                query: {
                    ...router.query,
                    mode: value,
                },
            },
            undefined,
            { shallow: true }
        );
    }, [router]);

    useEffect(() => {
        if (authLoading) return;
        if (!canAccessPage) return;
        if (id) {
            if (isSelfProfileMode || (isOwnProfile && !canView)) {
                void fetchOwnProfile();
            } else {
                void fetchManagerDetail();
            }
        }
    }, [authLoading, canAccessPage, canView, fetchManagerDetail, fetchOwnProfile, id, isOwnProfile, isSelfProfileMode]);

    useEffect(() => {
        const availableMonths = Array.from(
            new Set(
                (payrollData?.items || [])
                    .map((item) => {
                        const parsed = new Date(item.date);
                        return Number.isNaN(parsed.getTime()) ? null : formatMonthKey(parsed);
                    })
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((a, b) => b.localeCompare(a, 'ru'));

        if (availableMonths.length === 0) {
            setCalendarMonth('');
            return;
        }

        if (!calendarMonth || !availableMonths.includes(calendarMonth)) {
            setCalendarMonth(availableMonths[0]);
        }
    }, [calendarMonth, payrollData]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const groupedPermissions = useMemo(() => {
        const groups = new Map<string, ProfilePermission[]>();
        for (const permission of profilePermissions) {
            const groupLabel = getPermissionGroupLabel(permission.key);
            const current = groups.get(groupLabel) || [];
            current.push(permission);
            groups.set(groupLabel, current);
        }

        return Array.from(groups.entries())
            .map(([group, items]) => ({
                group,
                items: items.sort((a, b) => String(a.key).localeCompare(String(b.key), 'ru')),
            }))
            .sort((a, b) => a.group.localeCompare(b.group, 'ru'));
    }, [profilePermissions]);

    const managerPrintDocuments = useMemo<RecordPrintDocument[]>(() => {
        if (!manager) return [];

        const documents: RecordPrintDocument[] = [
            {
                key: 'manager-card',
                title: 'Карточка сотрудника',
                fileName: `Карточка сотрудника № ${manager.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Карточка сотрудника #${manager.id}`}
                        subtitle={manager.фио}
                        meta={
                            <>
                                <div>Статус: {manager.активен ? 'Работает' : 'Неактивен'}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Основные данные',
                                fields: [
                                    { label: 'ID', value: `#${manager.id}` },
                                    { label: 'ФИО', value: manager.фио || '—' },
                                    { label: 'Должность', value: manager.должность || '—' },
                                    { label: 'Телефон', value: manager.телефон || '—' },
                                    { label: 'Email', value: manager.email || '—' },
                                    { label: 'Ставка', value: manager.ставка != null ? formatCurrency(manager.ставка) : '—' },
                                    { label: 'Дата приема', value: manager.дата_приема ? formatDate(manager.дата_приема) : '—' },
                                    { label: 'Дата создания', value: formatDate(manager.created_at) },
                                ],
                            },
                            groupedPermissions.length
                                ? {
                                    title: 'Права доступа',
                                    table: {
                                        columns: ['Группа', 'Разрешения'],
                                        rows: groupedPermissions.map((group) => [
                                            group.group,
                                            group.items.map((permission) => permission.name || permission.key).join(', '),
                                        ]),
                                    },
                                }
                                : {
                                    title: 'Права доступа',
                                    note: 'Для этой карточки список прав доступа недоступен или не загружен.',
                                },
                        ]}
                    />
                ),
            },
        ];

        if (payrollData?.available) {
            documents.push({
                key: 'manager-payroll',
                title: 'Сводка по выплатам',
                fileName: `Сводка по выплатам сотрудника № ${manager.id} от ${new Date().toLocaleDateString('ru-RU')}`,
                content: (
                    <RecordPrintSheet
                        title={`Сводка по выплатам сотрудника #${manager.id}`}
                        subtitle={manager.фио}
                        meta={
                            <>
                                <div>Платежей: {payrollData.paymentCount}</div>
                                <div>Печать: {new Date().toLocaleString('ru-RU')}</div>
                            </>
                        }
                        sections={[
                            {
                                title: 'Сводка',
                                fields: [
                                    { label: 'Всего выплачено', value: formatCurrency(payrollData.totalPaid) },
                                    { label: 'Количество выплат', value: payrollData.paymentCount },
                                    { label: 'Последняя выплата', value: payrollData.latestPaymentDate ? formatDate(payrollData.latestPaymentDate) : '—' },
                                    { label: 'Период анализа', value: `${payrollData.monthsRequested} мес.` },
                                ],
                            },
                            payrollData.items.length
                                ? {
                                    title: 'История выплат',
                                    table: {
                                        columns: ['Дата', 'Тип', 'Статус', 'Сумма', 'Связанная заявка'],
                                        rows: payrollData.items.map((item) => [
                                            formatDate(item.date),
                                            item.type || '—',
                                            item.status || '—',
                                            formatCurrency(item.amount),
                                            item.relatedOrderId ? `#${item.relatedOrderId}` : '—',
                                        ]),
                                    },
                                }
                                : {
                                    title: 'История выплат',
                                    note: 'В выбранном периоде выплаты не найдены.',
                                },
                        ]}
                    />
                ),
            });
        }

        return documents;
    }, [formatCurrency, formatDate, groupedPermissions, manager, payrollData]);

    const payrollMonthOptions = useMemo(() => {
        return Array.from(
            new Set(
                (payrollData?.items || [])
                    .map((item) => {
                        const parsed = new Date(item.date);
                        return Number.isNaN(parsed.getTime()) ? null : formatMonthKey(parsed);
                    })
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((a, b) => b.localeCompare(a, 'ru'));
    }, [payrollData]);

    const selectedMonthPayments = useMemo(() => {
        if (!calendarMonth) return [];
        return (payrollData?.items || []).filter((item) => {
            const parsed = new Date(item.date);
            if (Number.isNaN(parsed.getTime())) return false;
            return formatMonthKey(parsed) === calendarMonth;
        });
    }, [calendarMonth, payrollData]);

    const selectedMonthTotal = useMemo(() => {
        return selectedMonthPayments.reduce((sum, item) => sum + item.amount, 0);
    }, [selectedMonthPayments]);

    const payrollCalendar = useMemo(() => {
        if (!calendarMonth) {
            return { monthTitle: '', weeks: [] as Array<Array<{ key: string; day: number | null; total: number; items: PayrollItem[] }>> };
        }

        const [yearRaw, monthRaw] = calendarMonth.split('-');
        const year = Number(yearRaw);
        const month = Number(monthRaw);
        if (!Number.isInteger(year) || !Number.isInteger(month)) {
            return { monthTitle: calendarMonth, weeks: [] as Array<Array<{ key: string; day: number | null; total: number; items: PayrollItem[] }>> };
        }

        const itemsByDate = new Map<string, PayrollItem[]>();
        for (const item of selectedMonthPayments) {
            const parsed = new Date(item.date);
            if (Number.isNaN(parsed.getTime())) continue;
            const key = formatIsoDateKey(parsed);
            const current = itemsByDate.get(key) || [];
            current.push(item);
            itemsByDate.set(key, current);
        }

        const firstDay = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const leadingSlots = (firstDay.getDay() + 6) % 7;
        const cells: Array<{ key: string; day: number | null; total: number; items: PayrollItem[] }> = [];

        for (let index = 0; index < leadingSlots; index++) {
            cells.push({ key: `empty-${index}`, day: null, total: 0, items: [] });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month - 1, day);
            const key = formatIsoDateKey(currentDate);
            const items = itemsByDate.get(key) || [];
            cells.push({
                key,
                day,
                total: items.reduce((sum, item) => sum + item.amount, 0),
                items,
            });
        }

        while (cells.length % 7 !== 0) {
            cells.push({ key: `tail-${cells.length}`, day: null, total: 0, items: [] });
        }

        const weeks: Array<Array<{ key: string; day: number | null; total: number; items: PayrollItem[] }>> = [];
        for (let index = 0; index < cells.length; index += 7) {
            weeks.push(cells.slice(index, index + 7));
        }

        return {
            monthTitle: formatMonthTitle(calendarMonth),
            weeks,
        };
    }, [calendarMonth, selectedMonthPayments]);

    const handleProfileSave = useCallback(async () => {
        if (!profileForm.fio.trim()) {
            setProfileMessageType('error');
            setProfileMessage('ФИО не может быть пустым.');
            return;
        }

        try {
            setProfileSaving(true);
            setProfileMessage(null);

            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fio: profileForm.fio,
                    phone: profileForm.phone,
                    email: profileForm.email,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as ProfilePayload | { error?: string };
            if (!response.ok) {
                setProfileMessageType('error');
                setProfileMessage((data as { error?: string })?.error || 'Ошибка обновления профиля');
                return;
            }

            await fetchOwnProfile();
            setProfileMessageType('success');
            setProfileMessage('Профиль обновлен.');
        } catch (err) {
            setProfileMessageType('error');
            setProfileMessage(err instanceof Error ? err.message : 'Ошибка обновления профиля');
        } finally {
            setProfileSaving(false);
        }
    }, [fetchOwnProfile, profileForm.email, profileForm.fio, profileForm.phone]);

    const handleOwnPasswordSave = async () => {
        const nextPassword = passwordForm.next.trim();
        const repeatPassword = passwordForm.repeat.trim();

        if (!nextPassword) {
            setPasswordError('Введите новый пароль.');
            return;
        }

        if (!repeatPassword) {
            setPasswordError('Повторите новый пароль.');
            return;
        }

        if (nextPassword !== repeatPassword) {
            setPasswordError('Пароли не совпадают.');
            return;
        }

        try {
            setPasswordSaving(true);
            setPasswordError(null);
            setPasswordSuccess(null);

            const response = await fetch('/api/profile/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: nextPassword }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
            if (!response.ok) {
                setPasswordError(data?.error || 'Ошибка смены пароля');
                return;
            }

            setPasswordForm({ next: '', repeat: '' });
            setShowPassword(false);
            setShowPasswordRepeat(false);
            setPasswordSuccess('Пароль успешно обновлен.');
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Ошибка смены пароля');
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!manager) return;
        if (!canDelete) {
            setError('Нет доступа');
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/managers?id=${manager.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления сотрудника');
            }
            router.push('/managers');
        } catch (err) {
            console.error('Error deleting manager:', err);
            setError('Ошибка удаления сотрудника: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
        }
    };

    const activePillClass = manager?.активен ? styles.statusPillGreen : styles.statusPillRed;

    if (authLoading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canAccessPage) {
        return <NoAccessPage />;
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header} />
            </div>
        );
    }

    if (error || !manager) {
        return (
            <div className={styles.container}>
                <Card size="3" variant="surface">
                    <Flex direction="column" gap="3">
                        <Text as="div" size="4" weight="bold">Ошибка</Text>
                        <Text as="div" color="red" size="2">
                            {error || 'Сотрудник не найден'}
                        </Text>
                        <Flex>
                            <Button variant="surface" color="gray" highContrast onClick={() => router.push('/managers')}>
                                Назад к сотрудникам
                            </Button>
                        </Flex>
                    </Flex>
                </Card>
            </div>
        );
    }

    if (isSelfProfileMode) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <Heading as="h1" size="6" className={styles.title}>
                                Мой профиль
                            </Heading>
                            <Text as="div" className={styles.subtitle}>
                                {manager.фио} • user #{user?.userId} • employee #{manager.id}
                            </Text>
                        </div>
                        <div className={styles.headerActions}>
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => router.push('/dashboard')}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiArrowLeft className={styles.icon} />
                                На дашборд
                            </Button>
                            <RecordDocumentCenter
                                documents={managerPrintDocuments}
                                buttonClassName={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            />
                            <Button
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => void fetchOwnProfile()}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiRefreshCw className={styles.icon} />
                                Обновить
                            </Button>
                        </div>
                    </div>
                </div>

                <Card size="3" variant="surface">
                    <div className={styles.profileSectionHeader}>
                        <div>
                            <Text as="div" size="3" weight="bold" className={styles.sectionTitle}>
                                Личный кабинет сотрудника
                            </Text>
                            <Text as="div" size="2" color="gray">
                                Здесь можно обновить свои данные, посмотреть права и историю выплат.
                            </Text>
                        </div>
                    </div>

                    <Box px="5" pb="5">
                        <Tabs.Root value={profileTab} onValueChange={(value) => void handleProfileTabChange(value)}>
                            <Tabs.List className={styles.profileTabsList}>
                                <Tabs.Trigger value="profile">Профиль</Tabs.Trigger>
                                <Tabs.Trigger value="permissions">Права</Tabs.Trigger>
                                <Tabs.Trigger value="salary">Зарплата</Tabs.Trigger>
                                <Tabs.Trigger value="schedule">График</Tabs.Trigger>
                                <Tabs.Trigger value="password">Пароль</Tabs.Trigger>
                            </Tabs.List>

                            <Tabs.Content value="profile" className={styles.profileTabContent}>
                                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                                    <Card size="2" variant="surface">
                                        <Flex direction="column" gap="4">
                                            <div className={styles.profileCardTitleRow}>
                                                <FiUser className={styles.icon} />
                                                <Text size="3" weight="bold">Основная информация</Text>
                                            </div>

                                            <div className={styles.profileField}>
                                                <Text as="label" size="2" weight="medium" htmlFor="profile-fio">ФИО</Text>
                                                <TextField.Root
                                                    id="profile-fio"
                                                    value={profileForm.fio}
                                                    onChange={(e) => {
                                                        setProfileForm((prev) => ({ ...prev, fio: e.target.value }));
                                                        setProfileMessage(null);
                                                    }}
                                                    className={styles.profileInput}
                                                    size="3"
                                                />
                                            </div>

                                            <div className={styles.profileField}>
                                                <Text as="label" size="2" weight="medium" htmlFor="profile-phone">Телефон</Text>
                                                <TextField.Root
                                                    id="profile-phone"
                                                    value={profileForm.phone}
                                                    onChange={(e) => {
                                                        setProfileForm((prev) => ({ ...prev, phone: e.target.value }));
                                                        setProfileMessage(null);
                                                    }}
                                                    className={styles.profileInput}
                                                    placeholder="+7 ..."
                                                    size="3"
                                                />
                                            </div>

                                            <div className={styles.profileField}>
                                                <Text as="label" size="2" weight="medium" htmlFor="profile-email">Email</Text>
                                                <TextField.Root
                                                    id="profile-email"
                                                    value={profileForm.email}
                                                    onChange={(e) => {
                                                        setProfileForm((prev) => ({ ...prev, email: e.target.value }));
                                                        setProfileMessage(null);
                                                    }}
                                                    className={styles.profileInput}
                                                    placeholder="name@example.com"
                                                    size="3"
                                                />
                                            </div>

                                            {profileMessage ? (
                                                <Text as="div" size="2" className={profileMessageType === 'error' ? styles.inlineError : styles.inlineSuccess}>
                                                    {profileMessage}
                                                </Text>
                                            ) : null}

                                            <Flex justify="end">
                                                <Button
                                                    type="button"
                                                    variant="solid"
                                                    color="gray"
                                                    highContrast
                                                    onClick={() => void handleProfileSave()}
                                                    disabled={profileSaving}
                                                    loading={profileSaving}
                                                    className={styles.primaryActionButton}
                                                >
                                                    <FiSave className={styles.icon} />
                                                    {profileSaving ? 'Сохранение…' : 'Сохранить изменения'}
                                                </Button>
                                            </Flex>
                                        </Flex>
                                    </Card>

                                    <Card size="2" variant="surface">
                                        <Flex direction="column" gap="4">
                                            <Text size="3" weight="bold">Сведения о сотруднике</Text>
                                            <div className={styles.summaryList}>
                                                <div className={styles.summaryRow}>
                                                    <Text size="2" color="gray">Должность</Text>
                                                    <Text size="2" weight="medium">{manager.должность || '—'}</Text>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <Text size="2" color="gray">Статус</Text>
                                                    <Badge variant="soft" color={manager.активен ? 'green' : 'red'} highContrast className={`${styles.statusPill} ${activePillClass}`}>
                                                        {manager.активен ? 'АКТИВЕН' : 'НЕАКТИВЕН'}
                                                    </Badge>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <Text size="2" color="gray">Ставка</Text>
                                                    <Text size="2" weight="medium">{manager.ставка ? formatCurrency(manager.ставка) : '—'}</Text>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <Text size="2" color="gray">Дата приема</Text>
                                                    <Text size="2" weight="medium">{manager.дата_приема ? formatDate(manager.дата_приема) : '—'}</Text>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <Text size="2" color="gray">Создан в системе</Text>
                                                    <Text size="2" weight="medium">{manager.created_at ? formatDate(manager.created_at) : '—'}</Text>
                                                </div>
                                            </div>
                                        </Flex>
                                    </Card>
                                </Grid>
                            </Tabs.Content>

                            <Tabs.Content value="permissions" className={styles.profileTabContent}>
                                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                                    <Card size="2" variant="surface">
                                        <Flex direction="column" gap="3">
                                            <Text size="3" weight="bold">Роли</Text>
                                            <Flex gap="2" wrap="wrap">
                                                {profileRoles.length ? profileRoles.map((role) => (
                                                    <Badge key={role} variant="soft" color="gray" highContrast>{role}</Badge>
                                                )) : <Text color="gray">Ролей нет</Text>}
                                            </Flex>
                                        </Flex>
                                    </Card>
                                    <Card size="2" variant="surface">
                                        <Flex direction="column" gap="2">
                                            <Text size="3" weight="bold">Эффективные права</Text>
                                            <Text size="2" color="gray">Только просмотр. Изменение прав доступно через администрирование.</Text>
                                        </Flex>
                                    </Card>
                                </Grid>

                                <div className={styles.permissionGroups}>
                                    {groupedPermissions.length ? groupedPermissions.map((group) => (
                                        <Card key={group.group} size="2" variant="surface" className={styles.permissionCard}>
                                            <div className={styles.profileCardTitleRow}>
                                                <FiShield className={styles.icon} />
                                                <Text size="3" weight="bold">{group.group}</Text>
                                            </div>
                                            <div className={styles.permissionList}>
                                                {group.items.map((permission) => (
                                                    <div key={permission.key} className={styles.permissionItem}>
                                                        <Text size="2" weight="medium">{permission.name || permission.key}</Text>
                                                        <Text size="1" color="gray">{permission.key}</Text>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )) : (
                                        <Card size="2" variant="surface">
                                            <Text color="gray">Права не найдены.</Text>
                                        </Card>
                                    )}
                                </div>
                            </Tabs.Content>

                            <Tabs.Content value="salary" className={styles.profileTabContent}>
                                <Flex justify="between" align="center" gap="4" wrap="wrap" className={styles.salaryToolbar}>
                                    <div>
                                        <Text size="3" weight="bold">Выплаты и зарплата</Text>
                                        <Text as="div" size="2" color="gray">
                                            Можно смотреть суммы за период и по датам выплат.
                                        </Text>
                                    </div>
                                    <Select.Root value={payrollMonths} onValueChange={setPayrollMonths}>
                                        <Select.Trigger className={styles.salarySelectTrigger} />
                                        <Select.Content>
                                            <Select.Item value="1">Последний месяц</Select.Item>
                                            <Select.Item value="3">Последние 3 месяца</Select.Item>
                                            <Select.Item value="6">Последние 6 месяцев</Select.Item>
                                            <Select.Item value="12">Последние 12 месяцев</Select.Item>
                                            <Select.Item value="24">Последние 24 месяца</Select.Item>
                                        </Select.Content>
                                    </Select.Root>
                                </Flex>

                                {!payrollData?.available ? (
                                    <Card size="2" variant="surface">
                                        <Text color="gray">
                                            История выплат пока недоступна. Либо в базе нет таблицы выплат, либо ее структура отличается от ожидаемой.
                                        </Text>
                                    </Card>
                                ) : (
                                    <>
                                        <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="4" className={styles.salarySummaryGrid}>
                                            <Card size="2" variant="surface" className={styles.metricCard}>
                                                <Text size="2" color="gray">Ставка</Text>
                                                <Text as="div" size="5" weight="bold">{manager.ставка ? formatCurrency(manager.ставка) : '—'}</Text>
                                            </Card>
                                            <Card size="2" variant="surface" className={styles.metricCard}>
                                                <Text size="2" color="gray">Выплачено за период</Text>
                                                <Text as="div" size="5" weight="bold">{formatCurrency(payrollData.totalPaid)}</Text>
                                            </Card>
                                            <Card size="2" variant="surface" className={styles.metricCard}>
                                                <Text size="2" color="gray">Выплачено за месяц</Text>
                                                <Text as="div" size="5" weight="bold">{formatCurrency(selectedMonthTotal)}</Text>
                                            </Card>
                                            <Card size="2" variant="surface" className={styles.metricCard}>
                                                <Text size="2" color="gray">Количество выплат</Text>
                                                <Text as="div" size="5" weight="bold">{payrollData.paymentCount}</Text>
                                            </Card>
                                        </Grid>

                                        <Grid columns={{ initial: '1', lg: '2' }} gap="4">
                                            <Card size="2" variant="surface">
                                                <Flex justify="between" align="center" gap="3" wrap="wrap" className={styles.calendarHeader}>
                                                    <div>
                                                        <Text size="3" weight="bold">Календарь выплат</Text>
                                                        <Text as="div" size="2" color="gray">{payrollCalendar.monthTitle || 'Нет данных за выбранный период'}</Text>
                                                    </div>
                                                    <Select.Root value={calendarMonth || undefined} onValueChange={setCalendarMonth}>
                                                        <Select.Trigger className={styles.salarySelectTrigger} placeholder="Выберите месяц" />
                                                        <Select.Content>
                                                            {payrollMonthOptions.map((monthOption) => (
                                                                <Select.Item key={monthOption} value={monthOption}>
                                                                    {formatMonthTitle(monthOption)}
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Flex>

                                                <div className={styles.calendarWeekdays}>
                                                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                                                        <div key={day} className={styles.calendarWeekday}>{day}</div>
                                                    ))}
                                                </div>

                                                <div className={styles.calendarGrid}>
                                                    {payrollCalendar.weeks.flat().map((cell) => (
                                                        <div
                                                            key={cell.key}
                                                            className={`${styles.calendarCell} ${cell.day ? styles.calendarCellActive : styles.calendarCellEmpty} ${cell.items.length ? styles.calendarCellHighlighted : ''}`}
                                                        >
                                                            {cell.day ? (
                                                                <>
                                                                    <Text size="2" weight="bold">{cell.day}</Text>
                                                                    {cell.items.length ? (
                                                                        <>
                                                                            <Text as="div" size="1" className={styles.calendarAmount}>
                                                                                {formatCurrency(cell.total)}
                                                                            </Text>
                                                                            <Text as="div" size="1" color="gray">
                                                                                {cell.items.length} выплат
                                                                            </Text>
                                                                        </>
                                                                    ) : (
                                                                        <Text as="div" size="1" color="gray">—</Text>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>

                                            <Card size="2" variant="surface">
                                                <Text size="3" weight="bold">Выплаты за выбранный месяц</Text>
                                                {selectedMonthPayments.length ? (
                                                    <div className={styles.tableWrapper}>
                                                        <Table.Root variant="surface" className={styles.table}>
                                                            <Table.Header>
                                                                <Table.Row>
                                                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell className={styles.textRight}>Сумма</Table.ColumnHeaderCell>
                                                                </Table.Row>
                                                            </Table.Header>
                                                            <Table.Body>
                                                                {selectedMonthPayments.map((item) => (
                                                                    <Table.Row key={item.id}>
                                                                        <Table.Cell>{formatDate(item.date)}</Table.Cell>
                                                                        <Table.Cell>{item.type || '—'}</Table.Cell>
                                                                        <Table.Cell>{item.status || '—'}</Table.Cell>
                                                                        <Table.Cell className={styles.textRight}>{formatCurrency(item.amount)}</Table.Cell>
                                                                    </Table.Row>
                                                                ))}
                                                            </Table.Body>
                                                        </Table.Root>
                                                    </div>
                                                ) : (
                                                    <Box pt="4">
                                                        <Text color="gray">За выбранный месяц выплат не найдено.</Text>
                                                    </Box>
                                                )}
                                            </Card>
                                        </Grid>
                                    </>
                                )}
                            </Tabs.Content>

                            <Tabs.Content value="schedule" className={styles.profileTabContent}>
                                <EmployeeSchedulePanel employeeId={manager.id} canEdit={canSelfScheduleEdit} canApplyPattern={canSelfScheduleApplyPattern} />
                            </Tabs.Content>

                            <Tabs.Content value="password" className={styles.profileTabContent}>
                                <Card size="2" variant="surface">
                                    <Flex direction="column" gap="4">
                                        <Text size="3" weight="bold">Управление паролем</Text>
                                        <Text size="2" color="gray">
                                            Текущий пароль нельзя показать: в системе хранится только его хеш. Можно сразу задать новый пароль.
                                        </Text>

                                        <div className={styles.passwordFieldGroup}>
                                            <Text as="label" size="2" weight="medium" htmlFor="self-password-next">
                                                Введите новый пароль
                                            </Text>
                                            <TextField.Root
                                                id="self-password-next"
                                                className={`${styles.passwordInput} ${passwordError ? styles.passwordInputError : ''}`}
                                                type={showPassword ? 'text' : 'password'}
                                                value={passwordForm.next}
                                                onChange={(e) => {
                                                    setPasswordForm((prev) => ({ ...prev, next: e.target.value }));
                                                    if (passwordError) setPasswordError(null);
                                                    if (passwordSuccess) setPasswordSuccess(null);
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
                                                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowPassword((prev) => !prev)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showPassword ? <EyeOff size={28} /> : <Eye size={28} />}
                                                    </button>
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </div>

                                        <div className={styles.passwordFieldGroup}>
                                            <Text as="label" size="2" weight="medium" htmlFor="self-password-repeat">
                                                Повторите новый пароль
                                            </Text>
                                            <TextField.Root
                                                id="self-password-repeat"
                                                className={`${styles.passwordInput} ${passwordError ? styles.passwordInputError : ''}`}
                                                type={showPasswordRepeat ? 'text' : 'password'}
                                                value={passwordForm.repeat}
                                                onChange={(e) => {
                                                    setPasswordForm((prev) => ({ ...prev, repeat: e.target.value }));
                                                    if (passwordError) setPasswordError(null);
                                                    if (passwordSuccess) setPasswordSuccess(null);
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
                                                        aria-label={showPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowPasswordRepeat((prev) => !prev)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showPasswordRepeat ? <EyeOff size={28} /> : <Eye size={28} />}
                                                    </button>
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </div>

                                        {passwordError ? <Text as="div" size="2" className={styles.inlineError}>{passwordError}</Text> : null}
                                        {passwordSuccess ? <Text as="div" size="2" className={styles.inlineSuccess}>{passwordSuccess}</Text> : null}

                                        <Flex justify="end">
                                            <Button
                                                type="button"
                                                variant="solid"
                                                color="gray"
                                                highContrast
                                                onClick={() => void handleOwnPasswordSave()}
                                                disabled={passwordSaving}
                                                loading={passwordSaving}
                                                className={styles.primaryActionButton}
                                            >
                                                {passwordSaving ? 'Смена…' : 'Сменить пароль'}
                                            </Button>
                                        </Flex>
                                    </Flex>
                                </Card>
                            </Tabs.Content>
                        </Tabs.Root>
                    </Box>
                </Card>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <ManagerHrWorkspace
                manager={manager}
                extraActions={<RecordDocumentCenter documents={managerPrintDocuments} />}
                canEdit={canEdit || isOwnProfile}
                canScheduleEdit={canScheduleManage}
                canScheduleApplyPattern={canScheduleManage}
                canDelete={canDelete}
                canAttachmentsView={canAttachmentsView}
                canAttachmentsUpload={canAttachmentsUpload}
                canAttachmentsDelete={canAttachmentsDelete}
                attachments={attachments}
                attachmentsLoading={attachmentsLoading}
                attachmentsError={attachmentsError}
                attachmentsUploading={attachmentsUploading}
                onBack={() => router.push(canView ? '/managers' : '/dashboard')}
                backLabel={canView ? 'Сотрудники' : 'Дашборд'}
                onRefreshBase={refreshBaseData}
                onRequestDelete={() => setIsDeleteDialogOpen(true)}
                onUploadAttachment={handleUploadAttachment}
                onDeleteAttachment={handleDeleteAttachment}
                onOpenAttachment={openPreview}
            />

            <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <Dialog.Content style={{ maxWidth: 980, width: '95vw' }}>
                    <Dialog.Title>{previewAttachment?.filename || 'Документ'}</Dialog.Title>
                    <Dialog.Description>{previewAttachment?.mime_type || ''}</Dialog.Description>

                    <Box style={{ marginTop: 12 }}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <img
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    alt={previewAttachment.filename}
                                    style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                                />
                            ) : (
                                <iframe
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    style={{ width: '100%', height: '75vh', border: '1px solid #eee', borderRadius: 8 }}
                                    title={previewAttachment.filename}
                                />
                            )
                        ) : (
                            <Text as="div" size="2" color="gray">
                                Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                            </Text>
                        )}
                    </Box>

                    <Flex gap="3" mt="4" justify="end">
                        {previewAttachment ? (
                            <a href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`} style={{ textDecoration: 'none' }}>
                                <Button variant="surface" color="gray" highContrast>
                                    <FiDownload className={styles.icon} /> Скачать
                                </Button>
                            </a>
                        ) : null}
                        <Dialog.Close>
                            <Button variant="surface" color="gray" highContrast>
                                Закрыть
                            </Button>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>

                    <Box className={deleteConfirmationStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить сотрудника? Это действие нельзя отменить.
                            </Text>

                            <Box className={deleteConfirmationStyles.positionsSection}>
                                <Flex direction="column" gap="1">
                                    <Text as="div" size="2" weight="bold">{manager.фио}</Text>
                                    <Text as="div" size="2" color="gray">Должность: {manager.должность}</Text>
                                    {manager.телефон ? <Text as="div" size="2" color="gray">Телефон: {manager.телефон}</Text> : null}
                                    {manager.email ? <Text as="div" size="2" color="gray">Email: {manager.email}</Text> : null}
                                </Flex>
                            </Box>

                            <Flex mt="4" gap="3" justify="end" className={deleteConfirmationStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmationStyles.modalDeleteButton}
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(ManagerDetailPage);
