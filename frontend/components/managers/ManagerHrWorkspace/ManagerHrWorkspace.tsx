import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
    FiBriefcase,
    FiCalendar,
    FiCreditCard,
    FiFileText,
    FiShield,
    FiUsers,
} from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui/card';
import {
    createEmptyManagerHrProfile,
    ManagerEmploymentEvent,
    ManagerHrProfile,
    ManagerIdentityDocument,
    ManagerMilitaryDocument,
    ManagerRelative,
} from '../../../lib/managerHr';
import { ManagerHrBankSection } from '@/components/managers/ManagerHrSections/ManagerHrBankSection';
import { ManagerHrEmploymentSection } from '@/components/managers/ManagerHrSections/ManagerHrEmploymentSection';
import { ManagerHrMainSection } from '@/components/managers/ManagerHrSections/ManagerHrMainSection';
import { ManagerHrMilitarySection } from '@/components/managers/ManagerHrSections/ManagerHrMilitarySection';
import { ManagerHrRelativesSection } from '@/components/managers/ManagerHrSections/ManagerHrRelativesSection';
import type { ManagerHrSelectOption } from '@/components/managers/ManagerHrSections/ManagerHrSelect';
import { ManagerHrHeader } from '@/components/managers/ManagerHrHeader/ManagerHrHeader';
import { ManagerHrSidebarNav } from '@/components/managers/ManagerHrSidebarNav/ManagerHrSidebarNav';
import { ManagerWorkScheduleSection } from '@/components/managers/ManagerWorkScheduleSection/ManagerWorkScheduleSection';
import type { AttachmentItem } from '@/types/attachments';
import { formatFileSize, formatRuCurrency, formatRuDate } from '@/utils/formatters';
import styles from './ManagerHrWorkspace.module.css';

type ManagerSummary = {
    id: number;
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен: boolean;
    created_at: string;
};

type SectionKey = 'main' | 'bank' | 'employment' | 'schedule' | 'relatives' | 'military';

const EMPTY_SELECT_VALUE = '__empty__';

type ManagerHrWorkspaceProps = {
    manager: ManagerSummary;
    extraActions?: React.ReactNode;
    canEdit: boolean;
    canScheduleEdit: boolean;
    canScheduleApplyPattern: boolean;
    canDelete: boolean;
    canAttachmentsView: boolean;
    canAttachmentsUpload: boolean;
    canAttachmentsDelete: boolean;
    attachments: AttachmentItem[];
    attachmentsLoading: boolean;
    attachmentsError: string | null;
    attachmentsUploading: boolean;
    onBack: () => void;
    backLabel: string;
    onRefreshBase: () => Promise<void> | void;
    onRequestDelete: () => void;
    onUploadAttachment: (file: File) => Promise<void> | void;
    onDeleteAttachment: (attachmentId: string) => Promise<void> | void;
    onOpenAttachment: (attachment: AttachmentItem) => void;
};

type SaveBadgeState = 'saved' | 'dirty' | 'saving';

const SECTION_QUERY_KEY = 'section';

const SECTION_KEYS: SectionKey[] = ['main', 'bank', 'employment', 'schedule', 'relatives', 'military'];

const isSectionKey = (value: unknown): value is SectionKey => {
    return typeof value === 'string' && SECTION_KEYS.includes(value as SectionKey);
};

const sectionItems: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'main', label: 'Основное', icon: <FiFileText /> },
    { key: 'bank', label: 'Банковские данные', icon: <FiCreditCard /> },
    { key: 'employment', label: 'Трудовая деятельность', icon: <FiBriefcase /> },
    { key: 'schedule', label: 'График работы', icon: <FiCalendar /> },
    { key: 'relatives', label: 'Родственники', icon: <FiUsers /> },
    { key: 'military', label: 'Воинский учет', icon: <FiShield /> },
];

const maritalStatusOptions = [
    { value: EMPTY_SELECT_VALUE, label: 'Не заполнено' },
    { value: 'single', label: 'Не состоит в браке' },
    { value: 'married', label: 'В браке' },
    { value: 'divorced', label: 'В разводе' },
    { value: 'widowed', label: 'Вдовец / вдова' },
];

const taxpayerStatusOptions = [
    { value: EMPTY_SELECT_VALUE, label: 'Не заполнено' },
    { value: 'resident', label: 'Налоговый резидент РФ' },
    { value: 'non_resident', label: 'Налоговый нерезидент РФ' },
    { value: 'highly_qualified', label: 'Высококвалифицированный специалист' },
];

const educationLevelOptions = [
    { value: EMPTY_SELECT_VALUE, label: 'Не заполнено' },
    { value: 'secondary', label: 'Среднее' },
    { value: 'secondary_special', label: 'Среднее специальное' },
    { value: 'higher', label: 'Высшее' },
    { value: 'postgraduate', label: 'Послевузовское' },
];

const contractTypeOptions = [
    { value: 'labor', label: 'Трудовой договор' },
    { value: 'gph', label: 'Договор ГПХ' },
    { value: 'internship', label: 'Стажировка' },
];

const laborBookOptions = [
    { value: EMPTY_SELECT_VALUE, label: 'Не заполнено' },
    { value: 'paper', label: 'Бумажная трудовая книжка' },
    { value: 'electronic', label: 'Электронная трудовая книжка' },
    { value: 'missing', label: 'Не выбрана / не предоставлена' },
];

const militaryRegistrationOptions = [
    { value: EMPTY_SELECT_VALUE, label: 'Не заполнено' },
    { value: 'common', label: 'Общий' },
    { value: 'special', label: 'Специальный (есть бронь)' },
    { value: 'removed', label: 'Снят с воинского учета' },
];

const managerHrMaritalStatusOptions: ManagerHrSelectOption[] = maritalStatusOptions;
const managerHrTaxpayerStatusOptions: ManagerHrSelectOption[] = taxpayerStatusOptions;
const managerHrEducationLevelOptions: ManagerHrSelectOption[] = educationLevelOptions;
const managerHrContractTypeOptions: ManagerHrSelectOption[] = contractTypeOptions;
const managerHrLaborBookOptions: ManagerHrSelectOption[] = laborBookOptions;
const managerHrMilitaryRegistrationOptions: ManagerHrSelectOption[] = militaryRegistrationOptions;

const formatCurrency = (value?: number) => formatRuCurrency(value);

const formatDate = (value?: string | null) => formatRuDate(value);

const formatBytes = (bytes: number) => formatFileSize(bytes, 'en');

const toSnapshot = (value: ManagerHrProfile | null) => JSON.stringify(value || null);

const createIdentityDocument = (): ManagerIdentityDocument => ({
    id: Date.now(),
    documentType: '',
    seriesNumber: '',
    issuedBy: '',
    departmentCode: '',
    issueDate: null,
    validUntil: null,
    isPrimary: false,
});

const createEmploymentEvent = (): ManagerEmploymentEvent => ({
    id: Date.now(),
    eventDate: null,
    eventType: '',
    details: '',
    status: '',
    sentDate: null,
    externalUuid: null,
});

const createRelative = (): ManagerRelative => ({
    id: Date.now(),
    fullName: '',
    relationType: '',
    birthDate: null,
    documentInfo: '',
    snils: '',
    phone: '',
    notes: '',
});

const createMilitaryDocument = (): ManagerMilitaryDocument => ({
    id: Date.now(),
    documentType: '',
    seriesNumber: '',
    issuedBy: '',
    issueDate: null,
    validUntil: null,
});

type ManagerHrCollectionItem =
    | ManagerIdentityDocument
    | ManagerEmploymentEvent
    | ManagerRelative
    | ManagerMilitaryDocument;

export function ManagerHrWorkspace({
    manager,
    extraActions,
    canEdit,
    canScheduleEdit,
    canScheduleApplyPattern,
    canDelete,
    canAttachmentsView,
    canAttachmentsUpload,
    canAttachmentsDelete,
    attachments,
    attachmentsLoading,
    attachmentsError,
    attachmentsUploading,
    onBack,
    backLabel,
    onRefreshBase,
    onRequestDelete,
    onUploadAttachment,
    onDeleteAttachment,
    onOpenAttachment,
}: ManagerHrWorkspaceProps): JSX.Element {
    const router = useRouter();
    const rawSection = Array.isArray(router.query[SECTION_QUERY_KEY])
        ? router.query[SECTION_QUERY_KEY]?.[0]
        : router.query[SECTION_QUERY_KEY];
    const sectionFromQuery = isSectionKey(rawSection) ? rawSection : 'main';

    const [activeSection, setActiveSection] = useState<SectionKey>(sectionFromQuery);
    const [data, setData] = useState<ManagerHrProfile | null>(null);
    const [schemaAvailable, setSchemaAvailable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadedSnapshot, setLoadedSnapshot] = useState<string>('');
    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/managers/${manager.id}/profile`);
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Ошибка загрузки кадровой карточки');
            }

            const normalized = payload?.data || createEmptyManagerHrProfile({
                employeeId: manager.id,
                fio: manager.фио,
                position: manager.должность,
                rate: manager.ставка ?? null,
                hireDate: manager.дата_приема ?? null,
                isActive: manager.активен,
                createdAt: manager.created_at ?? null,
                email: manager.email ?? null,
                phone: manager.телефон ?? null,
            });

            setSchemaAvailable(Boolean(payload?.available));
            setData(normalized);
            setLoadedSnapshot(toSnapshot(normalized));
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'Ошибка загрузки кадровой карточки');
        } finally {
            setLoading(false);
        }
    }, [manager]);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        setActiveSection(sectionFromQuery);
    }, [sectionFromQuery]);

    const isDirty = useMemo(() => toSnapshot(data) !== loadedSnapshot, [data, loadedSnapshot]);
    const readOnly = !canEdit || !schemaAvailable;

    const saveState: SaveBadgeState = saving ? 'saving' : isDirty ? 'dirty' : 'saved';

    const saveStateLabel =
        saveState === 'saving'
            ? 'Сохраняем изменения…'
            : saveState === 'dirty'
                ? 'Есть несохраненные изменения'
                : 'Все изменения сохранены';

    const patchSection = <T extends keyof ManagerHrProfile>(
        key: T,
        patch: Partial<ManagerHrProfile[T]>
    ) => {
        setData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [key]: {
                    ...(prev[key] as object),
                    ...(patch as object),
                },
            };
        });
    };

    const updateArrayItem = <T extends { id: number }>(
        key: 'identityDocuments' | 'employmentEvents' | 'relatives' | 'militaryDocuments',
        itemId: number,
        patch: Partial<T>
    ) => {
        setData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [key]: (prev[key] as unknown as T[]).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            };
        });
    };

    const appendArrayItem = (
        key: 'identityDocuments' | 'employmentEvents' | 'relatives' | 'militaryDocuments',
        item: ManagerIdentityDocument | ManagerEmploymentEvent | ManagerRelative | ManagerMilitaryDocument
    ) => {
        setData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [key]: [...(prev[key] as ManagerHrCollectionItem[]), item],
            };
        });
    };

    const removeArrayItem = (
        key: 'identityDocuments' | 'employmentEvents' | 'relatives' | 'militaryDocuments',
        itemId: number
    ) => {
        setData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [key]: (prev[key] as ManagerHrCollectionItem[]).filter((item) => item.id !== itemId),
            };
        });
    };

    const handleSave = async () => {
        if (!data || readOnly) return;
        try {
            setSaving(true);
            setError(null);

            const response = await fetch(`/api/managers/${manager.id}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'Ошибка сохранения кадровой карточки');
            }

            setSchemaAvailable(Boolean(payload?.available));
            setData(payload.data);
            setLoadedSnapshot(toSnapshot(payload.data));
            await onRefreshBase();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Ошибка сохранения кадровой карточки');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !data) {
        return (
            <div className={styles.pageShell}>
                <div className={styles.loadingState}>Загрузка кадровой карточки…</div>
            </div>
        );
    }

    const personal = data.personal;
    const bank = data.bank;
    const employment = data.employment;
    const military = data.military;

    return (
        <div className={styles.pageShell}>
            <ManagerHrSidebarNav
                activeSection={activeSection}
                backLabel={backLabel}
                items={sectionItems}
                onBack={onBack}
                onSelect={(section) => {
                    setActiveSection(section);
                    void router.replace(
                        {
                            pathname: router.pathname,
                            query: {
                                ...router.query,
                                [SECTION_QUERY_KEY]: section,
                            },
                        },
                        undefined,
                        { shallow: true }
                    );
                }}
            />

            <div className={styles.content}>
                <ManagerHrHeader
                    title={data.manager.fio || manager.фио}
                    subtitle={data.manager.position || manager.должность || 'Карточка сотрудника и кадровые данные'}
                    saveStateLabel={saveStateLabel}
                    isActive={data.manager.isActive}
                    extraActions={extraActions}
                    canSave={!readOnly}
                    canDelete={canDelete}
                    saveDisabled={saving || !isDirty || !schemaAvailable}
                    saving={saving}
                    onRefresh={() => {
                        void onRefreshBase();
                        void fetchProfile();
                    }}
                    onSave={() => void handleSave()}
                    onDelete={onRequestDelete}
                />

                {!schemaAvailable ? (
                    <Card className={styles.alertCard}>
                        <CardContent className={styles.alertContent}>
                            <div className={styles.alertText}>
                            HR-структура для сотрудников еще не создана в БД. Запусти SQL-скрипт из `scripts/2026-03-27-managers-hr-profile.sql`, после чего карточка начнет сохранять расширенные поля.
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {error ? (
                    <Card className={styles.alertCard}>
                        <CardContent className={styles.alertContent}>
                            <div className={`${styles.alertText} ${styles.alertTextError}`}>{error}</div>
                        </CardContent>
                    </Card>
                ) : null}

                <div className={styles.summaryGrid}>
                    <Card className={styles.metricCard}>
                        <CardContent className={styles.metricContent}>
                            <div className={styles.metricLabel}>Должность</div>
                            <div className={styles.metricValue}>{data.manager.position || '—'}</div>
                        </CardContent>
                    </Card>
                    <Card className={styles.metricCard}>
                        <CardContent className={styles.metricContent}>
                            <div className={styles.metricLabel}>Ставка</div>
                            <div className={styles.metricValue}>{formatCurrency(data.manager.rate ?? undefined)}</div>
                        </CardContent>
                    </Card>
                    <Card className={styles.metricCard}>
                        <CardContent className={styles.metricContent}>
                            <div className={styles.metricLabel}>Дата приема</div>
                            <div className={styles.metricValue}>{formatDate(data.manager.hireDate)}</div>
                        </CardContent>
                    </Card>
                </div>

                {activeSection === 'main' ? (
                    <ManagerHrMainSection
                        managerId={manager.id}
                        personal={personal}
                        identityDocuments={data.identityDocuments}
                        readOnly={readOnly}
                        emptySelectValue={EMPTY_SELECT_VALUE}
                        maritalStatusOptions={managerHrMaritalStatusOptions}
                        taxpayerStatusOptions={managerHrTaxpayerStatusOptions}
                        educationLevelOptions={managerHrEducationLevelOptions}
                        canAttachmentsView={canAttachmentsView}
                        canAttachmentsUpload={canAttachmentsUpload}
                        canAttachmentsDelete={canAttachmentsDelete}
                        attachments={attachments}
                        attachmentsLoading={attachmentsLoading}
                        attachmentsError={attachmentsError}
                        attachmentsUploading={attachmentsUploading}
                        formatBytes={formatBytes}
                        onPatchPersonal={(patch) => patchSection('personal', patch)}
                        onAppendIdentityDocument={() => appendArrayItem('identityDocuments', createIdentityDocument())}
                        onUpdateIdentityDocument={(itemId, patch) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', itemId, patch)}
                        onRemoveIdentityDocument={(itemId) => removeArrayItem('identityDocuments', itemId)}
                        onUploadAttachment={onUploadAttachment}
                        onDeleteAttachment={onDeleteAttachment}
                        onOpenAttachment={onOpenAttachment}
                    />
                ) : null}

                {activeSection === 'bank' ? (
                    <ManagerHrBankSection
                        bank={bank}
                        readOnly={readOnly}
                        onPatchBank={(patch) => patchSection('bank', patch)}
                    />
                ) : null}

                {activeSection === 'employment' ? (
                    <ManagerHrEmploymentSection
                        managerId={manager.id}
                        employment={employment}
                        employmentEvents={data.employmentEvents}
                        readOnly={readOnly}
                        emptySelectValue={EMPTY_SELECT_VALUE}
                        contractTypeOptions={managerHrContractTypeOptions}
                        laborBookOptions={managerHrLaborBookOptions}
                        onPatchEmployment={(patch) => patchSection('employment', patch)}
                        onAppendEmploymentEvent={() => appendArrayItem('employmentEvents', createEmploymentEvent())}
                        onUpdateEmploymentEvent={(itemId, patch) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', itemId, patch)}
                        onRemoveEmploymentEvent={(itemId) => removeArrayItem('employmentEvents', itemId)}
                    />
                ) : null}

                {activeSection === 'schedule' ? (
                    <ManagerWorkScheduleSection
                        employeeId={manager.id}
                        canEdit={canScheduleEdit}
                        canApplyPattern={canScheduleApplyPattern}
                    />
                ) : null}

                {activeSection === 'relatives' ? (
                    <ManagerHrRelativesSection
                        relatives={data.relatives}
                        readOnly={readOnly}
                        onAppendRelative={() => appendArrayItem('relatives', createRelative())}
                        onUpdateRelative={(itemId, patch) => updateArrayItem<ManagerRelative>('relatives', itemId, patch)}
                        onRemoveRelative={(itemId) => removeArrayItem('relatives', itemId)}
                    />
                ) : null}

                {activeSection === 'military' ? (
                    <ManagerHrMilitarySection
                        military={military}
                        militaryDocuments={data.militaryDocuments}
                        readOnly={readOnly}
                        emptySelectValue={EMPTY_SELECT_VALUE}
                        militaryRegistrationOptions={managerHrMilitaryRegistrationOptions}
                        onPatchMilitary={(patch) => patchSection('military', patch)}
                        onAppendMilitaryDocument={() => appendArrayItem('militaryDocuments', createMilitaryDocument())}
                        onUpdateMilitaryDocument={(itemId, patch) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', itemId, patch)}
                        onRemoveMilitaryDocument={(itemId) => removeArrayItem('militaryDocuments', itemId)}
                    />
                ) : null}
            </div>
        </div>
    );
}
