import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Flex, Grid, Select, Table, Text, TextField } from '@radix-ui/themes';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiUsers,
} from 'react-icons/fi';
import {
  createEmptyManagerHrProfile,
  ManagerEmploymentEvent,
  ManagerHrProfile,
  ManagerIdentityDocument,
  ManagerMilitaryDocument,
  ManagerRelative,
} from '../lib/managerHr';
import { EmployeeSchedulePanel } from './EmployeeSchedulePanel';
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

type AttachmentItem = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type SectionKey = 'main' | 'bank' | 'employment' | 'schedule' | 'relatives' | 'military';

const EMPTY_SELECT_VALUE = '__empty__';

type ManagerHrWorkspaceProps = {
  manager: ManagerSummary;
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

const formatCurrency = (value?: number) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
};

const formatBytes = (bytes: number) => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

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

export function ManagerHrWorkspace({
  manager,
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
  const [activeSection, setActiveSection] = useState<SectionKey>('main');
  const [data, setData] = useState<ManagerHrProfile | null>(null);
  const [schemaAvailable, setSchemaAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedSnapshot, setLoadedSnapshot] = useState<string>('');
  const [fileInputKey, setFileInputKey] = useState(0);

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
        [key]: [...(prev[key] as Array<any>), item],
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
        [key]: (prev[key] as Array<any>).filter((item) => item.id !== itemId),
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

  const renderSaveBadge = () => (
    <div className={styles.saveState}>
      <FiCheck className={styles.saveStateIcon} />
      <span>{saveStateLabel}</span>
    </div>
  );

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
      <aside className={styles.sidebar}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          <FiArrowLeft />
          <span>{backLabel}</span>
        </button>

        <div className={styles.sectionNav}>
          {sectionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeSection === item.key ? styles.sectionNavButtonActive : styles.sectionNavButton}
              onClick={() => setActiveSection(item.key)}
            >
              <span className={styles.sectionNavIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{data.manager.fio || manager.фио}</h1>
            {renderSaveBadge()}
          </div>

          <div className={styles.headerActions}>
            <Badge variant="soft" color={data.manager.isActive ? 'green' : 'red'} highContrast className={styles.statusBadge}>
              {data.manager.isActive ? 'Работает' : 'Неактивен'}
            </Badge>

            <Button
              type="button"
              variant="surface"
              color="gray"
              highContrast
              className={styles.surfaceButton}
              onClick={() => {
                void onRefreshBase();
                void fetchProfile();
              }}
            >
              <FiRefreshCw size={16} />
              Обновить
            </Button>

            {!readOnly ? (
              <Button
                type="button"
                variant="solid"
                color="gray"
                highContrast
                className={styles.primaryButton}
                onClick={() => void handleSave()}
                disabled={saving || !isDirty || !schemaAvailable}
              >
                <FiSave size={16} />
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                type="button"
                variant="surface"
                color="gray"
                highContrast
                className={styles.deleteButton}
                onClick={onRequestDelete}
              >
                <FiTrash2 size={16} />
                Удалить
              </Button>
            ) : null}
          </div>
        </div>

        {!schemaAvailable ? (
          <Card size="2" variant="surface" className={styles.alertCard}>
            <Text size="2" color="orange">
              HR-структура для сотрудников еще не создана в БД. Запусти SQL-скрипт из `scripts/2026-03-27-managers-hr-profile.sql`, после чего карточка начнет сохранять расширенные поля.
            </Text>
          </Card>
        ) : null}

        {error ? (
          <Card size="2" variant="surface" className={styles.alertCard}>
            <Text size="2" color="red">{error}</Text>
          </Card>
        ) : null}

        <Grid columns={{ initial: '1', xl: '3' }} gap="4" className={styles.summaryGrid}>
          <Card size="2" variant="surface" className={styles.metricCard}>
            <Text size="2" color="gray">Должность</Text>
            <Text as="div" size="5" weight="bold">{data.manager.position || '—'}</Text>
          </Card>
          <Card size="2" variant="surface" className={styles.metricCard}>
            <Text size="2" color="gray">Ставка</Text>
            <Text as="div" size="5" weight="bold">{formatCurrency(data.manager.rate ?? undefined)}</Text>
          </Card>
          <Card size="2" variant="surface" className={styles.metricCard}>
            <Text size="2" color="gray">Дата приема</Text>
            <Text as="div" size="5" weight="bold">{formatDate(data.manager.hireDate)}</Text>
          </Card>
        </Grid>

        {activeSection === 'main' ? (
          <div className={styles.sectionStack}>
            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Основная информация</Text>
              </div>
              <Grid columns={{ initial: '1', lg: '4' }} gap="4" className={styles.formGrid}>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Фамилия</Text>
                  <TextField.Root
                    value={personal.lastName}
                    onChange={(e) => patchSection('personal', { lastName: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Имя</Text>
                  <TextField.Root
                    value={personal.firstName}
                    onChange={(e) => patchSection('personal', { firstName: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Отчество</Text>
                  <TextField.Root
                    value={personal.middleName}
                    onChange={(e) => patchSection('personal', { middleName: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Пол</Text>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="gender"
                        checked={personal.gender === 'male'}
                        onChange={() => patchSection('personal', { gender: 'male' })}
                        disabled={readOnly}
                      />
                      <span>Мужской</span>
                    </label>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="gender"
                        checked={personal.gender === 'female'}
                        onChange={() => patchSection('personal', { gender: 'female' })}
                        disabled={readOnly}
                      />
                      <span>Женский</span>
                    </label>
                  </div>
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Дата рождения</Text>
                  <TextField.Root
                    type="date"
                    value={personal.birthDate || ''}
                    onChange={(e) => patchSection('personal', { birthDate: e.target.value || null })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Место рождения</Text>
                  <TextField.Root
                    value={personal.birthPlace}
                    onChange={(e) => patchSection('personal', { birthPlace: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Семейное положение</Text>
                  <Select.Root
                    value={personal.maritalStatus || EMPTY_SELECT_VALUE}
                    onValueChange={(value) => patchSection('personal', { maritalStatus: value === EMPTY_SELECT_VALUE ? '' : value })}
                    disabled={readOnly}
                  >
                    <Select.Trigger className={styles.selectTrigger} />
                    <Select.Content className={styles.selectContent}>
                      {maritalStatusOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>
                          {option.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Состоит с</Text>
                  <TextField.Root
                    type="date"
                    value={personal.maritalStatusSince || ''}
                    onChange={(e) => patchSection('personal', { maritalStatusSince: e.target.value || null })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">СНИЛС</Text>
                  <TextField.Root
                    value={personal.snils}
                    onChange={(e) => patchSection('personal', { snils: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">ИНН</Text>
                  <TextField.Root
                    value={personal.inn}
                    onChange={(e) => patchSection('personal', { inn: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Статус налогоплательщика</Text>
                  <Select.Root
                    value={personal.taxpayerStatus || EMPTY_SELECT_VALUE}
                    onValueChange={(value) => patchSection('personal', { taxpayerStatus: value === EMPTY_SELECT_VALUE ? '' : value })}
                    disabled={readOnly}
                  >
                    <Select.Trigger className={styles.selectTrigger} />
                    <Select.Content className={styles.selectContent}>
                      {taxpayerStatusOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>
                          {option.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Код гражданства</Text>
                  <TextField.Root
                    value={personal.citizenshipCode}
                    onChange={(e) => patchSection('personal', { citizenshipCode: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Гражданство</Text>
                  <TextField.Root
                    value={personal.citizenshipLabel}
                    onChange={(e) => patchSection('personal', { citizenshipLabel: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
              </Grid>
            </Card>

            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Адреса и контакты</Text>
              </div>
              <Grid columns={{ initial: '1', lg: '2' }} gap="4" className={styles.formGrid}>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Адрес регистрации</Text>
                  <textarea
                    className={styles.textarea}
                    value={personal.registrationAddress}
                    onChange={(e) => patchSection('personal', { registrationAddress: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Дата регистрации</Text>
                  <TextField.Root
                    type="date"
                    value={personal.registrationDate || ''}
                    onChange={(e) => patchSection('personal', { registrationDate: e.target.value || null })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={personal.actualAddressSameAsRegistration}
                      onChange={(e) => patchSection('personal', { actualAddressSameAsRegistration: e.target.checked })}
                      disabled={readOnly}
                    />
                    <span>Фактический адрес совпадает с регистрацией</span>
                  </label>
                </div>
                {!personal.actualAddressSameAsRegistration ? (
                  <>
                    <div className={styles.fieldWide}>
                      <Text as="label" size="2" weight="medium">Фактический адрес</Text>
                      <textarea
                        className={styles.textarea}
                        value={personal.actualAddress}
                        onChange={(e) => patchSection('personal', { actualAddress: e.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div className={styles.field}>
                      <Text as="label" size="2" weight="medium">Дата начала проживания</Text>
                      <TextField.Root
                        type="date"
                        value={personal.actualAddressSince || ''}
                        onChange={(e) => patchSection('personal', { actualAddressSince: e.target.value || null })}
                        className={styles.input}
                        disabled={readOnly}
                      />
                    </div>
                  </>
                ) : null}
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Личный email</Text>
                  <TextField.Root
                    value={personal.personalEmail}
                    onChange={(e) => patchSection('personal', { personalEmail: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Рабочий email</Text>
                  <TextField.Root
                    value={personal.workEmail}
                    onChange={(e) => patchSection('personal', { workEmail: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Основной телефон</Text>
                  <TextField.Root
                    value={personal.primaryPhone}
                    onChange={(e) => patchSection('personal', { primaryPhone: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Рабочий телефон</Text>
                  <TextField.Root
                    value={personal.workPhone}
                    onChange={(e) => patchSection('personal', { workPhone: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
              </Grid>
            </Card>

            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Документы, удостоверяющие личность</Text>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="surface"
                    color="gray"
                    highContrast
                    className={styles.surfaceButton}
                    onClick={() => appendArrayItem('identityDocuments', createIdentityDocument())}
                  >
                    <FiPlus size={16} />
                    Добавить документ
                  </Button>
                ) : null}
              </div>

              {data.identityDocuments.length === 0 ? (
                <div className={styles.emptyState}>Документы пока не добавлены.</div>
              ) : (
                <div className={styles.rowList}>
                  {data.identityDocuments.map((doc) => (
                    <div key={doc.id} className={styles.inlineRowCard}>
                      <Grid columns={{ initial: '1', md: '2', xl: '6' }} gap="3">
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Вид документа</Text>
                          <TextField.Root
                            value={doc.documentType}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { documentType: e.target.value })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Серия и номер</Text>
                          <TextField.Root
                            value={doc.seriesNumber}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { seriesNumber: e.target.value })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                        <div className={styles.fieldWide}>
                          <Text as="label" size="1" color="gray">Кем выдан</Text>
                          <TextField.Root
                            value={doc.issuedBy}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { issuedBy: e.target.value })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Код подразделения</Text>
                          <TextField.Root
                            value={doc.departmentCode}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { departmentCode: e.target.value })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Выдан</Text>
                          <TextField.Root
                            type="date"
                            value={doc.issueDate || ''}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { issueDate: e.target.value || null })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Действует до</Text>
                          <TextField.Root
                            type="date"
                            value={doc.validUntil || ''}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { validUntil: e.target.value || null })}
                            className={styles.input}
                            disabled={readOnly}
                          />
                        </div>
                      </Grid>

                      <div className={styles.inlineRowFooter}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={doc.isPrimary}
                            onChange={(e) => updateArrayItem<ManagerIdentityDocument>('identityDocuments', doc.id, { isPrimary: e.target.checked })}
                            disabled={readOnly}
                          />
                          <span>Основной документ</span>
                        </label>
                        {!readOnly ? (
                          <button type="button" className={styles.rowDeleteButton} onClick={() => removeArrayItem('identityDocuments', doc.id)}>
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Образование и навыки</Text>
              </div>
              <Grid columns={{ initial: '1', lg: '2' }} gap="4" className={styles.formGrid}>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Уровень образования</Text>
                  <Select.Root
                    value={personal.educationLevel || EMPTY_SELECT_VALUE}
                    onValueChange={(value) => patchSection('personal', { educationLevel: value === EMPTY_SELECT_VALUE ? '' : value })}
                    disabled={readOnly}
                  >
                    <Select.Trigger className={styles.selectTrigger} />
                    <Select.Content className={styles.selectContent}>
                      {educationLevelOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>
                          {option.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Основная профессия</Text>
                  <TextField.Root
                    value={personal.primaryProfession}
                    onChange={(e) => patchSection('personal', { primaryProfession: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Дополнительная профессия</Text>
                  <TextField.Root
                    value={personal.secondaryProfession}
                    onChange={(e) => patchSection('personal', { secondaryProfession: e.target.value })}
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Иностранные языки</Text>
                  <TextField.Root
                    value={personal.languages.join(', ')}
                    onChange={(e) =>
                      patchSection('personal', {
                        languages: e.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Например: Английский, Немецкий"
                    className={styles.input}
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Примечания</Text>
                  <textarea
                    className={styles.textarea}
                    value={personal.notes}
                    onChange={(e) => patchSection('personal', { notes: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </Grid>
            </Card>

            {canAttachmentsView ? (
              <Card size="2" variant="surface">
                <div className={styles.cardHeader}>
                  <Text size="5" weight="bold">Файлы сотрудника</Text>
                  {canAttachmentsUpload ? (
                    <label className={styles.uploadLabel}>
                      <input
                        key={fileInputKey}
                        type="file"
                        className={styles.hiddenInput}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void Promise.resolve(onUploadAttachment(file)).finally(() => {
                              setFileInputKey((prev) => prev + 1);
                            });
                          }
                        }}
                      />
                      <span className={styles.uploadButton}>
                        <FiUploadCloud size={16} />
                        {attachmentsUploading ? 'Загрузка…' : 'Добавить файл'}
                      </span>
                    </label>
                  ) : null}
                </div>

                {attachmentsError ? <Text size="2" color="red">{attachmentsError}</Text> : null}

                {attachmentsLoading ? (
                  <div className={styles.emptyState}>Загрузка документов…</div>
                ) : attachments.length === 0 ? (
                  <div className={styles.emptyState}>Нет прикрепленных документов.</div>
                ) : (
                  <Table.Root variant="surface" className={styles.table}>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Файл</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Размер</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {attachments.map((attachment) => (
                        <Table.Row key={attachment.id}>
                          <Table.Cell>{attachment.filename}</Table.Cell>
                          <Table.Cell>{attachment.mime_type}</Table.Cell>
                          <Table.Cell>{formatBytes(attachment.size_bytes)}</Table.Cell>
                          <Table.Cell>
                            <Flex justify="end" gap="2" wrap="wrap">
                              <Button type="button" variant="surface" color="gray" highContrast className={styles.surfaceButton} onClick={() => onOpenAttachment(attachment)}>
                                Открыть
                              </Button>
                              {canAttachmentsDelete ? (
                                <Button
                                  type="button"
                                  variant="surface"
                                  color="gray"
                                  highContrast
                                  className={styles.deleteButton}
                                  onClick={() => {
                                    void onDeleteAttachment(attachment.id);
                                  }}
                                >
                                  Удалить
                                </Button>
                              ) : null}
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Card>
            ) : null}
          </div>
        ) : null}

        {activeSection === 'bank' ? (
          <Card size="2" variant="surface">
            <div className={styles.cardHeader}>
              <Text size="5" weight="bold">Банковские данные</Text>
            </div>
            <Grid columns={{ initial: '1', lg: '2' }} gap="4" className={styles.formGrid}>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">Банк</Text>
                <TextField.Root value={bank.bankName} onChange={(e) => patchSection('bank', { bankName: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">БИК</Text>
                <TextField.Root value={bank.bankBik} onChange={(e) => patchSection('bank', { bankBik: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">Расчетный счет</Text>
                <TextField.Root value={bank.settlementAccount} onChange={(e) => patchSection('bank', { settlementAccount: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">Корреспондентский счет</Text>
                <TextField.Root value={bank.correspondentAccount} onChange={(e) => patchSection('bank', { correspondentAccount: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">Карта МИР</Text>
                <TextField.Root value={bank.mirCardNumber} onChange={(e) => patchSection('bank', { mirCardNumber: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <Text as="label" size="2" weight="medium">Иная организация</Text>
                <TextField.Root value={bank.alternativeBankName} onChange={(e) => patchSection('bank', { alternativeBankName: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.fieldWide}>
                <Text as="label" size="2" weight="medium">Счет в иной организации</Text>
                <TextField.Root value={bank.alternativeAccountNumber} onChange={(e) => patchSection('bank', { alternativeAccountNumber: e.target.value })} className={styles.input} disabled={readOnly} />
              </div>
              <div className={styles.fieldWide}>
                <Text as="label" size="2" weight="medium">Комментарий</Text>
                <textarea className={styles.textarea} value={bank.notes} onChange={(e) => patchSection('bank', { notes: e.target.value })} disabled={readOnly} />
              </div>
            </Grid>
          </Card>
        ) : null}

        {activeSection === 'employment' ? (
          <div className={styles.sectionStack}>
            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Трудовая деятельность</Text>
              </div>
              <Grid columns={{ initial: '1', lg: '3' }} gap="4" className={styles.formGrid}>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Категория должности</Text>
                  <TextField.Root value={employment.positionCategory} onChange={(e) => patchSection('employment', { positionCategory: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Подразделение</Text>
                  <TextField.Root value={employment.departmentName} onChange={(e) => patchSection('employment', { departmentName: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Отдел / группа</Text>
                  <TextField.Root value={employment.subdivisionName} onChange={(e) => patchSection('employment', { subdivisionName: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={employment.isFlightCrew} onChange={(e) => patchSection('employment', { isFlightCrew: e.target.checked })} disabled={readOnly} />
                    <span>Летно-подъемный состав</span>
                  </label>
                </div>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={employment.isSeaCrew} onChange={(e) => patchSection('employment', { isSeaCrew: e.target.checked })} disabled={readOnly} />
                    <span>Плавающий состав</span>
                  </label>
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Тип договора</Text>
                  <div className={styles.radioGroup}>
                    {contractTypeOptions.map((option) => (
                      <label key={option.value} className={styles.radioOption}>
                        <input
                          type="radio"
                          checked={employment.contractType === option.value}
                          onChange={() => patchSection('employment', { contractType: option.value })}
                          disabled={readOnly}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Трудовая книжка</Text>
                  <Select.Root value={employment.laborBookStatus || EMPTY_SELECT_VALUE} onValueChange={(value) => patchSection('employment', { laborBookStatus: value === EMPTY_SELECT_VALUE ? '' : value })} disabled={readOnly}>
                    <Select.Trigger className={styles.selectTrigger} />
                    <Select.Content className={styles.selectContent}>
                      {laborBookOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Комментарий по трудовой книжке</Text>
                  <textarea className={styles.textarea} value={employment.laborBookNotes} onChange={(e) => patchSection('employment', { laborBookNotes: e.target.value })} disabled={readOnly} />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Основание для работы иностранца / примечание</Text>
                  <textarea className={styles.textarea} value={employment.foreignWorkPermitNote} onChange={(e) => patchSection('employment', { foreignWorkPermitNote: e.target.value })} disabled={readOnly} />
                </div>
              </Grid>
            </Card>

            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Сведения о трудовой деятельности</Text>
                {!readOnly ? (
                  <Button type="button" variant="surface" color="gray" highContrast className={styles.surfaceButton} onClick={() => appendArrayItem('employmentEvents', createEmploymentEvent())}>
                    <FiPlus size={16} />
                    Добавить событие
                  </Button>
                ) : null}
              </div>

              {data.employmentEvents.length === 0 ? (
                <div className={styles.emptyState}>Пока нет кадровых событий.</div>
              ) : (
                <div className={styles.rowList}>
                  {data.employmentEvents.map((event) => (
                    <div key={event.id} className={styles.inlineRowCard}>
                      <Grid columns={{ initial: '1', md: '2', xl: '5' }} gap="3">
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Дата мероприятия</Text>
                          <TextField.Root type="date" value={event.eventDate || ''} onChange={(e) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', event.id, { eventDate: e.target.value || null })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Вид мероприятия</Text>
                          <TextField.Root value={event.eventType} onChange={(e) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', event.id, { eventType: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.fieldWide}>
                          <Text as="label" size="1" color="gray">Информация</Text>
                          <TextField.Root value={event.details} onChange={(e) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', event.id, { details: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Статус</Text>
                          <TextField.Root value={event.status} onChange={(e) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', event.id, { status: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Дата отправки</Text>
                          <TextField.Root type="date" value={event.sentDate || ''} onChange={(e) => updateArrayItem<ManagerEmploymentEvent>('employmentEvents', event.id, { sentDate: e.target.value || null })} className={styles.input} disabled={readOnly} />
                        </div>
                      </Grid>
                      {!readOnly ? (
                        <div className={styles.inlineRowFooter}>
                          <button type="button" className={styles.rowDeleteButton} onClick={() => removeArrayItem('employmentEvents', event.id)}>
                            Удалить
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {activeSection === 'schedule' ? (
          <Card size="2" variant="surface">
            <div className={styles.cardHeader}>
              <div>
                <Text as="div" size="5" weight="bold">График работы</Text>
                <Text as="div" size="2" color="gray">
                  Месяц, неделя, шаблон графика и отпуск сотрудника в одной карточке.
                </Text>
              </div>
            </div>
            <EmployeeSchedulePanel employeeId={manager.id} canEdit={canScheduleEdit} canApplyPattern={canScheduleApplyPattern} />
          </Card>
        ) : null}

        {activeSection === 'relatives' ? (
          <Card size="2" variant="surface">
            <div className={styles.cardHeader}>
              <Text size="5" weight="bold">Родственники</Text>
              {!readOnly ? (
                <Button type="button" variant="surface" color="gray" highContrast className={styles.surfaceButton} onClick={() => appendArrayItem('relatives', createRelative())}>
                  <FiPlus size={16} />
                  Добавить
                </Button>
              ) : null}
            </div>

            {data.relatives.length === 0 ? (
              <div className={styles.emptyState}>У сотрудника пока нет родственников.</div>
            ) : (
              <div className={styles.rowList}>
                {data.relatives.map((relative) => (
                  <div key={relative.id} className={styles.inlineRowCard}>
                    <Grid columns={{ initial: '1', md: '2', xl: '5' }} gap="3">
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">ФИО</Text>
                        <TextField.Root value={relative.fullName} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { fullName: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">Степень родства</Text>
                        <TextField.Root value={relative.relationType} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { relationType: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">Дата рождения</Text>
                        <TextField.Root type="date" value={relative.birthDate || ''} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { birthDate: e.target.value || null })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">Документ</Text>
                        <TextField.Root value={relative.documentInfo} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { documentInfo: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">СНИЛС</Text>
                        <TextField.Root value={relative.snils} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { snils: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.field}>
                        <Text as="label" size="1" color="gray">Телефон</Text>
                        <TextField.Root value={relative.phone} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { phone: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                      <div className={styles.fieldWide}>
                        <Text as="label" size="1" color="gray">Комментарий</Text>
                        <TextField.Root value={relative.notes} onChange={(e) => updateArrayItem<ManagerRelative>('relatives', relative.id, { notes: e.target.value })} className={styles.input} disabled={readOnly} />
                      </div>
                    </Grid>
                    {!readOnly ? (
                      <div className={styles.inlineRowFooter}>
                        <button type="button" className={styles.rowDeleteButton} onClick={() => removeArrayItem('relatives', relative.id)}>
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {activeSection === 'military' ? (
          <div className={styles.sectionStack}>
            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Сведения о воинском учете</Text>
              </div>
              <Grid columns={{ initial: '1', lg: '2' }} gap="4" className={styles.formGrid}>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Отношение к военной службе</Text>
                  <TextField.Root value={military.relationToService} onChange={(e) => patchSection('military', { relationToService: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Категория запаса</Text>
                  <TextField.Root value={military.reserveCategory} onChange={(e) => patchSection('military', { reserveCategory: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Воинское звание</Text>
                  <TextField.Root value={military.militaryRank} onChange={(e) => patchSection('military', { militaryRank: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Состав</Text>
                  <TextField.Root value={military.unitComposition} onChange={(e) => patchSection('military', { unitComposition: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Код ВУС</Text>
                  <TextField.Root value={military.specialtyCode} onChange={(e) => patchSection('military', { specialtyCode: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Категория годности</Text>
                  <TextField.Root value={military.fitnessCategory} onChange={(e) => patchSection('military', { fitnessCategory: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Дата проверки</Text>
                  <TextField.Root type="date" value={military.fitnessCheckedAt || ''} onChange={(e) => patchSection('military', { fitnessCheckedAt: e.target.value || null })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Военкомат</Text>
                  <TextField.Root value={military.commissariatName} onChange={(e) => patchSection('military', { commissariatName: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.field}>
                  <Text as="label" size="2" weight="medium">Указать вручную</Text>
                  <TextField.Root value={military.commissariatManual} onChange={(e) => patchSection('military', { commissariatManual: e.target.value })} className={styles.input} disabled={readOnly} />
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Вид воинского учета</Text>
                  <Select.Root value={military.militaryRegistrationType || EMPTY_SELECT_VALUE} onValueChange={(value) => patchSection('military', { militaryRegistrationType: value === EMPTY_SELECT_VALUE ? '' : value })} disabled={readOnly}>
                    <Select.Trigger className={styles.selectTrigger} />
                    <Select.Content className={styles.selectContent}>
                      {militaryRegistrationOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div className={styles.fieldWide}>
                  <Text as="label" size="2" weight="medium">Дополнительные сведения</Text>
                  <textarea className={styles.textarea} value={military.additionalInfo} onChange={(e) => patchSection('military', { additionalInfo: e.target.value })} disabled={readOnly} />
                </div>
              </Grid>
            </Card>

            <Card size="2" variant="surface">
              <div className={styles.cardHeader}>
                <Text size="5" weight="bold">Документы воинского учета</Text>
                {!readOnly ? (
                  <Button type="button" variant="surface" color="gray" highContrast className={styles.surfaceButton} onClick={() => appendArrayItem('militaryDocuments', createMilitaryDocument())}>
                    <FiPlus size={16} />
                    Добавить документ
                  </Button>
                ) : null}
              </div>

              {data.militaryDocuments.length === 0 ? (
                <div className={styles.emptyState}>У сотрудника пока нет документов воинского учета.</div>
              ) : (
                <div className={styles.rowList}>
                  {data.militaryDocuments.map((doc) => (
                    <div key={doc.id} className={styles.inlineRowCard}>
                      <Grid columns={{ initial: '1', md: '2', xl: '5' }} gap="3">
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Тип документа</Text>
                          <TextField.Root value={doc.documentType} onChange={(e) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', doc.id, { documentType: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Серия и номер</Text>
                          <TextField.Root value={doc.seriesNumber} onChange={(e) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', doc.id, { seriesNumber: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.fieldWide}>
                          <Text as="label" size="1" color="gray">Кем выдан</Text>
                          <TextField.Root value={doc.issuedBy} onChange={(e) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', doc.id, { issuedBy: e.target.value })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Дата выдачи</Text>
                          <TextField.Root type="date" value={doc.issueDate || ''} onChange={(e) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', doc.id, { issueDate: e.target.value || null })} className={styles.input} disabled={readOnly} />
                        </div>
                        <div className={styles.field}>
                          <Text as="label" size="1" color="gray">Действует до</Text>
                          <TextField.Root type="date" value={doc.validUntil || ''} onChange={(e) => updateArrayItem<ManagerMilitaryDocument>('militaryDocuments', doc.id, { validUntil: e.target.value || null })} className={styles.input} disabled={readOnly} />
                        </div>
                      </Grid>
                      {!readOnly ? (
                        <div className={styles.inlineRowFooter}>
                          <button type="button" className={styles.rowDeleteButton} onClick={() => removeArrayItem('militaryDocuments', doc.id)}>
                            Удалить
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
