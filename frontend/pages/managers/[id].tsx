import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './ManagerDetail.module.css';
import { FiArrowLeft, FiDownload, FiRefreshCw, FiSave, FiShield, FiUser } from 'react-icons/fi';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { ManagerHrWorkspace } from '../../components/pages/ManagerHrWorkspace/ManagerHrWorkspace';
import { ManagerWorkScheduleSection } from '../../components/managers/ManagerWorkScheduleSection/ManagerWorkScheduleSection';
import { RecordDocumentCenter, RecordPrintSheet, type RecordPrintDocument } from '../../components/print/RecordDocumentCenter';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
    Dialog as UiDialog,
    DialogContent as UiDialogContent,
    DialogDescription as UiDialogDescription,
    DialogTitle as UiDialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

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

const buildRecentMonthOptions = (monthsCount: number, anchor: Date = new Date()): string[] => {
    const safeMonthsCount = Number.isInteger(monthsCount) && monthsCount > 0 ? monthsCount : 1;
    const normalizedAnchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);

    return Array.from({ length: safeMonthsCount }, (_, index) => {
        const currentMonth = new Date(normalizedAnchor.getFullYear(), normalizedAnchor.getMonth() - index, 1);
        return formatMonthKey(currentMonth);
    });
};

const getPermissionGroupLabel = (permissionKey: string): string => {
    const prefix = String(permissionKey || '').split('.')[0] || 'other';
    return PROFILE_PERMISSION_LABELS.get(prefix) || prefix;
};

const SELF_PROFILE_TABS: Array<{ value: ProfileTab; label: string }> = [
    { value: 'profile', label: 'Профиль' },
    { value: 'permissions', label: 'Права' },
    { value: 'salary', label: 'Зарплата' },
    { value: 'schedule', label: 'График' },
    { value: 'password', label: 'Пароль' },
];

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

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }, []);

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    }, []);

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
        const requestedMonths = payrollData?.monthsRequested || Number(payrollMonths) || 6;
        const monthsFromPeriod = buildRecentMonthOptions(requestedMonths);
        const monthsFromPayments = (payrollData?.items || [])
            .map((item) => {
                const parsed = new Date(item.date);
                return Number.isNaN(parsed.getTime()) ? null : formatMonthKey(parsed);
            })
            .filter((value): value is string => Boolean(value));

        return Array.from(new Set([...monthsFromPeriod, ...monthsFromPayments])).sort((a, b) => b.localeCompare(a, 'ru'));
    }, [payrollData, payrollMonths]);

    useEffect(() => {
        if (payrollMonthOptions.length === 0) {
            setCalendarMonth('');
            return;
        }

        if (!calendarMonth || !payrollMonthOptions.includes(calendarMonth)) {
            setCalendarMonth(payrollMonthOptions[0]);
        }
    }, [calendarMonth, payrollMonthOptions]);

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
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canAccessPage) {
        return <NoAccessPage />;
    }

    if (loading) {
        return <PageLoader label="Загрузка сотрудника..." fullPage />;
    }

    if (error || !manager) {
        return (
            <div className={styles.container}>
                <Card className={styles.errorCard}>
                    <CardContent className={styles.errorCardContent}>
                        <div className={styles.errorTitle}>Ошибка</div>
                        <div className={styles.errorMessage}>
                            {error || 'Сотрудник не найден'}
                        </div>
                        <div>
                            <Button type="button" variant="outline" onClick={() => router.push('/managers')}>
                                Назад к сотрудникам
                            </Button>
                        </div>
                    </CardContent>
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
                            <h1 className={styles.title}>Мой профиль</h1>
                            <div className={styles.subtitle}>
                                {manager.фио} • user #{user?.userId} • employee #{manager.id}
                            </div>
                        </div>
                        <div className={styles.headerActions}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push('/dashboard')}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiArrowLeft className={styles.icon} />
                                На дашборд
                            </Button>
                            <RecordDocumentCenter
                                documents={managerPrintDocuments}
                                buttonClassName={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                                saveTarget={canAttachmentsUpload ? { entityType: 'manager', entityId: managerId } : undefined}
                                onSaved={() => fetchAttachments(managerId)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void fetchOwnProfile()}
                                className={`${styles.button} ${styles.secondaryButton} ${styles.surfaceButton}`}
                            >
                                <FiRefreshCw className={styles.icon} />
                                Обновить
                            </Button>
                        </div>
                    </div>
                </div>

                <Card className={styles.profileRootCard}>
                    <div className={styles.profileSectionHeader}>
                        <div>
                            <div className={styles.sectionTitle}>Личный кабинет сотрудника</div>
                            <div className={styles.profileSectionDescription}>
                                Здесь можно обновить свои данные, посмотреть права и историю выплат.
                            </div>
                        </div>
                    </div>

                    <div className={styles.profileBody}>
                        <div className={styles.profileTabsList}>
                            {SELF_PROFILE_TABS.map((tab) => (
                                <Button
                                    key={tab.value}
                                    type="button"
                                    variant="outline"
                                    className={`${styles.profileTabButton} ${profileTab === tab.value ? styles.profileTabButtonActive : ''}`}
                                    onClick={() => void handleProfileTabChange(tab.value)}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>

                        {profileTab === 'profile' ? (
                            <div className={`${styles.profileTabContent} ${styles.profileGrid2}`}>
                                <Card className={styles.profileSurfaceCard}>
                                    <CardContent className={styles.profileSurfaceCardBody}>
                                        <div className={styles.profileCardTitleRow}>
                                            <FiUser className={styles.icon} />
                                            <div className={styles.profileCardTitle}>Основная информация</div>
                                        </div>

                                        <div className={styles.profileField}>
                                            <Label htmlFor="profile-fio">ФИО</Label>
                                            <Input
                                                id="profile-fio"
                                                value={profileForm.fio}
                                                onChange={(e) => {
                                                    setProfileForm((prev) => ({ ...prev, fio: e.target.value }));
                                                    setProfileMessage(null);
                                                }}
                                                className={styles.profileInput}
                                            />
                                        </div>

                                        <div className={styles.profileField}>
                                            <Label htmlFor="profile-phone">Телефон</Label>
                                            <Input
                                                id="profile-phone"
                                                value={profileForm.phone}
                                                onChange={(e) => {
                                                    setProfileForm((prev) => ({ ...prev, phone: e.target.value }));
                                                    setProfileMessage(null);
                                                }}
                                                className={styles.profileInput}
                                                placeholder="+7 ..."
                                            />
                                        </div>

                                        <div className={styles.profileField}>
                                            <Label htmlFor="profile-email">Email</Label>
                                            <Input
                                                id="profile-email"
                                                value={profileForm.email}
                                                onChange={(e) => {
                                                    setProfileForm((prev) => ({ ...prev, email: e.target.value }));
                                                    setProfileMessage(null);
                                                }}
                                                className={styles.profileInput}
                                                placeholder="name@example.com"
                                            />
                                        </div>

                                        {profileMessage ? (
                                            <div className={profileMessageType === 'error' ? styles.inlineError : styles.inlineSuccess}>
                                                {profileMessage}
                                            </div>
                                        ) : null}

                                        <div className={styles.profileActionsEnd}>
                                            <Button
                                                type="button"
                                                variant="default"
                                                onClick={() => void handleProfileSave()}
                                                disabled={profileSaving}
                                                className={styles.primaryActionButton}
                                            >
                                                <FiSave className={styles.icon} />
                                                {profileSaving ? 'Сохранение…' : 'Сохранить изменения'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className={styles.profileSurfaceCard}>
                                    <CardContent className={styles.profileSurfaceCardBody}>
                                        <div className={styles.profileCardTitle}>Сведения о сотруднике</div>
                                        <div className={styles.summaryList}>
                                            <div className={styles.summaryRow}>
                                                <div className={styles.summaryLabel}>Должность</div>
                                                <div className={styles.summaryValue}>{manager.должность || '—'}</div>
                                            </div>
                                            <div className={styles.summaryRow}>
                                                <div className={styles.summaryLabel}>Статус</div>
                                                <Badge variant="outline" className={`${styles.statusPill} ${activePillClass}`}>
                                                    {manager.активен ? 'АКТИВЕН' : 'НЕАКТИВЕН'}
                                                </Badge>
                                            </div>
                                            <div className={styles.summaryRow}>
                                                <div className={styles.summaryLabel}>Ставка</div>
                                                <div className={styles.summaryValue}>{manager.ставка ? formatCurrency(manager.ставка) : '—'}</div>
                                            </div>
                                            <div className={styles.summaryRow}>
                                                <div className={styles.summaryLabel}>Дата приема</div>
                                                <div className={styles.summaryValue}>{manager.дата_приема ? formatDate(manager.дата_приема) : '—'}</div>
                                            </div>
                                            <div className={styles.summaryRow}>
                                                <div className={styles.summaryLabel}>Создан в системе</div>
                                                <div className={styles.summaryValue}>{manager.created_at ? formatDate(manager.created_at) : '—'}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}

                        {profileTab === 'permissions' ? (
                            <div className={styles.profileTabContent}>
                                <div className={styles.profileGrid2}>
                                    <Card className={styles.profileSurfaceCard}>
                                        <CardContent className={styles.profileSurfaceCardBody}>
                                            <div className={styles.profileCardTitle}>Роли</div>
                                            <div className={styles.rolesWrap}>
                                                {profileRoles.length ? profileRoles.map((role) => (
                                                    <Badge key={role} variant="outline" className={styles.roleBadge}>{role}</Badge>
                                                )) : <div className={styles.mutedText}>Ролей нет</div>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className={styles.profileSurfaceCard}>
                                        <CardContent className={styles.profileSurfaceCardBody}>
                                            <div className={styles.profileCardTitle}>Эффективные права</div>
                                            <div className={styles.mutedText}>Только просмотр. Изменение прав доступно через администрирование.</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className={styles.permissionGroups}>
                                    {groupedPermissions.length ? groupedPermissions.map((group) => (
                                        <Card key={group.group} className={`${styles.profileSurfaceCard} ${styles.permissionCard}`}>
                                            <CardContent className={styles.profileSurfaceCardBody}>
                                                <div className={styles.profileCardTitleRow}>
                                                    <FiShield className={styles.icon} />
                                                    <div className={styles.profileCardTitle}>{group.group}</div>
                                                </div>
                                                <div className={styles.permissionList}>
                                                    {group.items.map((permission) => (
                                                        <div key={permission.key} className={styles.permissionItem}>
                                                            <div className={styles.permissionName}>{permission.name || permission.key}</div>
                                                            <div className={styles.permissionKey}>{permission.key}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )) : (
                                        <Card className={styles.profileSurfaceCard}>
                                            <CardContent className={styles.profileSurfaceCardBody}>
                                                <div className={styles.mutedText}>Права не найдены.</div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {profileTab === 'salary' ? (
                            <div className={styles.profileTabContent}>
                                <div className={styles.salaryToolbar}>
                                    <div>
                                        <div className={styles.profileCardTitle}>Выплаты и зарплата</div>
                                        <div className={styles.mutedText}>Можно смотреть суммы за период и по датам выплат.</div>
                                    </div>
                                    <Select value={payrollMonths} onValueChange={(value) => setPayrollMonths(String(value))}>
                                        <SelectTrigger className={styles.salarySelectTrigger}>
                                            <SelectValue>
                                                {{
                                                    '1': 'Последний месяц',
                                                    '3': 'Последние 3 месяца',
                                                    '6': 'Последние 6 месяцев',
                                                    '12': 'Последние 12 месяцев',
                                                    '24': 'Последние 24 месяца',
                                                }[payrollMonths] || payrollMonths}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Последний месяц</SelectItem>
                                            <SelectItem value="3">Последние 3 месяца</SelectItem>
                                            <SelectItem value="6">Последние 6 месяцев</SelectItem>
                                            <SelectItem value="12">Последние 12 месяцев</SelectItem>
                                            <SelectItem value="24">Последние 24 месяца</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {!payrollData?.available ? (
                                    <Card className={styles.profileSurfaceCard}>
                                        <CardContent className={styles.profileSurfaceCardBody}>
                                            <div className={styles.mutedText}>
                                                История выплат пока недоступна. Либо в базе нет таблицы выплат, либо ее структура отличается от ожидаемой.
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <>
                                        <div className={`${styles.salarySummaryGrid} ${styles.profileGrid4}`}>
                                            <Card className={`${styles.profileSurfaceCard} ${styles.metricCard}`}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.summaryLabel}>Ставка</div>
                                                    <div className={styles.metricValue}>{manager.ставка ? formatCurrency(manager.ставка) : '—'}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className={`${styles.profileSurfaceCard} ${styles.metricCard}`}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.summaryLabel}>Выплачено за период</div>
                                                    <div className={styles.metricValue}>{formatCurrency(payrollData.totalPaid)}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className={`${styles.profileSurfaceCard} ${styles.metricCard}`}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.summaryLabel}>Выплачено за месяц</div>
                                                    <div className={styles.metricValue}>{formatCurrency(selectedMonthTotal)}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className={`${styles.profileSurfaceCard} ${styles.metricCard}`}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.summaryLabel}>Количество выплат</div>
                                                    <div className={styles.metricValue}>{payrollData.paymentCount}</div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className={styles.profileGrid2}>
                                            <Card className={styles.profileSurfaceCard}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.calendarHeader}>
                                                        <div>
                                                            <div className={styles.profileCardTitle}>Календарь выплат</div>
                                                            <div className={styles.mutedText}>{payrollCalendar.monthTitle || 'Нет данных за выбранный период'}</div>
                                                        </div>
                                                        <Select value={calendarMonth || undefined} onValueChange={(value) => setCalendarMonth(String(value))}>
                                                            <SelectTrigger className={styles.salarySelectTrigger}>
                                                                <SelectValue>{calendarMonth ? formatMonthTitle(calendarMonth) : 'Выберите месяц'}</SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {payrollMonthOptions.map((monthOption) => (
                                                                    <SelectItem key={monthOption} value={monthOption}>
                                                                        {formatMonthTitle(monthOption)}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

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
                                                                        <div className={styles.calendarDay}>{cell.day}</div>
                                                                        {cell.items.length ? (
                                                                            <>
                                                                                <div className={styles.calendarAmount}>{formatCurrency(cell.total)}</div>
                                                                                <div className={styles.calendarMeta}>{cell.items.length} выплат</div>
                                                                            </>
                                                                        ) : (
                                                                            <div className={styles.calendarMeta}>—</div>
                                                                        )}
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className={styles.profileSurfaceCard}>
                                                <CardContent className={styles.profileSurfaceCardBody}>
                                                    <div className={styles.profileCardTitle}>Выплаты за выбранный месяц</div>
                                                    {selectedMonthPayments.length ? (
                                                        <div className={styles.tableWrapper}>
                                                            <Table className={styles.table}>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Дата</TableHead>
                                                                        <TableHead>Тип</TableHead>
                                                                        <TableHead>Статус</TableHead>
                                                                        <TableHead className={styles.textRight}>Сумма</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {selectedMonthPayments.map((item) => (
                                                                        <TableRow key={item.id}>
                                                                            <TableCell>{formatDate(item.date)}</TableCell>
                                                                            <TableCell>{item.type || '—'}</TableCell>
                                                                            <TableCell>{item.status || '—'}</TableCell>
                                                                            <TableCell className={styles.textRight}>{formatCurrency(item.amount)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    ) : (
                                                        <div className={styles.emptyTableState}>За выбранный месяц выплат не найдено.</div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}

                        {profileTab === 'schedule' ? (
                            <div className={styles.profileTabContent}>
                                <ManagerWorkScheduleSection
                                    employeeId={manager.id}
                                    canEdit={canSelfScheduleEdit}
                                    canApplyPattern={canSelfScheduleApplyPattern}
                                />
                            </div>
                        ) : null}

                        {profileTab === 'password' ? (
                            <div className={styles.profileTabContent}>
                                <Card className={styles.profileSurfaceCard}>
                                    <CardContent className={styles.profileSurfaceCardBody}>
                                        <div className={styles.profileCardTitle}>Управление паролем</div>
                                        <div className={styles.mutedText}>
                                            Текущий пароль нельзя показать: в системе хранится только его хеш. Можно сразу задать новый пароль.
                                        </div>

                                        <form
                                            autoComplete="off"
                                            onSubmit={(event) => event.preventDefault()}
                                            className={styles.passwordForm}
                                        >
                                            <input
                                                type="text"
                                                name="username"
                                                autoComplete="username"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'none' }}
                                            />
                                            <input
                                                type="password"
                                                name="current-password"
                                                autoComplete="current-password"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'none' }}
                                            />

                                            <div className={styles.passwordFieldGroup}>
                                                <Label htmlFor="self-password-next">Введите новый пароль</Label>
                                                <div className={`${styles.passwordInput} ${passwordError ? styles.passwordInputError : ''}`}>
                                                    <span className={styles.passwordSlot} aria-hidden="true">
                                                        <Lock size={18} />
                                                    </span>
                                                    <Input
                                                        id="self-password-next"
                                                        name="self-new-password"
                                                        className={styles.passwordInputField}
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={passwordForm.next}
                                                        autoComplete="new-password"
                                                        autoCorrect="off"
                                                        autoCapitalize="none"
                                                        spellCheck={false}
                                                        data-lpignore="true"
                                                        data-form-type="other"
                                                        onChange={(e) => {
                                                            setPasswordForm((prev) => ({ ...prev, next: e.target.value }));
                                                            if (passwordError) setPasswordError(null);
                                                            if (passwordSuccess) setPasswordSuccess(null);
                                                        }}
                                                        placeholder="Введите новый пароль"
                                                    />
                                                    <button
                                                        type="button"
                                                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowPassword((prev) => !prev)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={styles.passwordFieldGroup}>
                                                <Label htmlFor="self-password-repeat">Повторите новый пароль</Label>
                                                <div className={`${styles.passwordInput} ${passwordError ? styles.passwordInputError : ''}`}>
                                                    <span className={styles.passwordSlot} aria-hidden="true">
                                                        <Lock size={18} />
                                                    </span>
                                                    <Input
                                                        id="self-password-repeat"
                                                        name="self-repeat-password"
                                                        className={styles.passwordInputField}
                                                        type={showPasswordRepeat ? 'text' : 'password'}
                                                        value={passwordForm.repeat}
                                                        autoComplete="new-password"
                                                        autoCorrect="off"
                                                        autoCapitalize="none"
                                                        spellCheck={false}
                                                        data-lpignore="true"
                                                        data-form-type="other"
                                                        onChange={(e) => {
                                                            setPasswordForm((prev) => ({ ...prev, repeat: e.target.value }));
                                                            if (passwordError) setPasswordError(null);
                                                            if (passwordSuccess) setPasswordSuccess(null);
                                                        }}
                                                        placeholder="Повторите новый пароль"
                                                    />
                                                    <button
                                                        type="button"
                                                        aria-label={showPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                                                        onClick={() => setShowPasswordRepeat((prev) => !prev)}
                                                        className={styles.passwordToggle}
                                                    >
                                                        {showPasswordRepeat ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </form>

                                        {passwordError ? <div className={styles.inlineError}>{passwordError}</div> : null}
                                        {passwordSuccess ? <div className={styles.inlineSuccess}>{passwordSuccess}</div> : null}

                                        <div className={styles.profileActionsEnd}>
                                            <Button
                                                type="button"
                                                variant="default"
                                                onClick={() => void handleOwnPasswordSave()}
                                                disabled={passwordSaving}
                                                className={styles.primaryActionButton}
                                            >
                                                {passwordSaving ? 'Смена…' : 'Сменить пароль'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className={styles.workspaceContainer}>
            <ManagerHrWorkspace
                manager={manager}
                extraActions={
                    <RecordDocumentCenter
                        documents={managerPrintDocuments}
                        saveTarget={canAttachmentsUpload ? { entityType: 'manager', entityId: managerId } : undefined}
                        onSaved={() => fetchAttachments(managerId)}
                    />
                }
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

            <UiDialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <UiDialogContent className={styles.previewDialog}>
                    <div className={styles.previewHeader}>
                        <UiDialogTitle className={styles.previewTitle}>{previewAttachment?.filename || 'Документ'}</UiDialogTitle>
                        <UiDialogDescription className={styles.previewDescription}>{previewAttachment?.mime_type || ''}</UiDialogDescription>
                    </div>

                    <div className={styles.previewBody}>
                        {previewAttachment && canPreviewInline(previewAttachment) ? (
                            previewAttachment.mime_type.toLowerCase().startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(previewAttachment.filename) ? (
                                <Image
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    alt={previewAttachment.filename}
                                    width={1400}
                                    height={900}
                                    unoptimized
                                    className={styles.previewImage}
                                />
                            ) : (
                                <iframe
                                    src={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/inline`}
                                    className={styles.previewFrame}
                                    title={previewAttachment.filename}
                                />
                            )
                        ) : (
                            <p className={styles.previewFallback}>
                                Предпросмотр недоступен для этого формата. Используй &quot;Скачать&quot;.
                            </p>
                        )}
                    </div>

                    <div className={styles.previewActions}>
                        {previewAttachment ? (
                            <a href={`/api/attachments/${encodeURIComponent(previewAttachment.id)}/download`} className={styles.previewLink}>
                                <Button type="button" variant="outline" className={styles.previewButton}>
                                    <FiDownload className={styles.icon} /> Скачать
                                </Button>
                            </a>
                        ) : null}
                        <Button type="button" variant="outline" className={styles.previewButton} onClick={() => setIsPreviewOpen(false)}>
                            Закрыть
                        </Button>
                    </div>
                </UiDialogContent>
            </UiDialog>

            <DeleteConfirmation
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                loading={isDeleting}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить сотрудника?"
                warning="Это действие нельзя отменить. Карточка сотрудника и связанные с ней данные будут удалены."
                details={(
                    <div>
                        <div className={styles.deleteTitle}>{manager.фио}</div>
                        <div className={styles.deleteMeta}>Должность: {manager.должность}</div>
                        {manager.телефон ? <div className={styles.deleteMeta}>Телефон: {manager.телефон}</div> : null}
                        {manager.email ? <div className={styles.deleteMeta}>Email: {manager.email}</div> : null}
                    </div>
                )}
            />
        </div>
    );
}

export default withLayout(ManagerDetailPage);
