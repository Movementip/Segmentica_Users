import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Flex, Select, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi';
import styles from './ClientContragentModal.module.css';
import {
    SUPPLIER_CONTRAGENT_TYPES,
    isSupplierOrganizationContragentType,
    normalizeSupplierContragentType,
    type SupplierBankAccount,
    type SupplierContragent,
    type SupplierContragentPayload,
} from '../lib/supplierContragents';

type SupplierContragentModalProps = {
    error?: string | null;
    isOpen: boolean;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (payload: SupplierContragentPayload) => Promise<void> | void;
    submitLabel: string;
    title: string;
    value?: Partial<SupplierContragent> | null;
};

type SupplierFormState = Omit<SupplierContragentPayload, 'bankAccounts'> & {
    bankAccounts: SupplierBankAccount[];
};

const createEmptyBankAccount = (index = 0): SupplierBankAccount => ({
    name: index === 0 ? 'Основной расчетный счет' : `Расчетный счет ${index + 1}`,
    bik: '',
    bankName: '',
    correspondentAccount: '',
    settlementAccount: '',
    isPrimary: index === 0,
    sortOrder: index,
});

const createInitialState = (value?: Partial<SupplierContragent> | null): SupplierFormState => ({
    название: value?.название || '',
    телефон: value?.телефон || '',
    email: value?.email || '',
    адрес: value?.адрес || '',
    тип: normalizeSupplierContragentType(value?.тип),
    рейтинг: value?.рейтинг ?? 5,
    краткоеНазвание: value?.краткоеНазвание || '',
    полноеНазвание: value?.полноеНазвание || '',
    фамилия: value?.фамилия || '',
    имя: value?.имя || '',
    отчество: value?.отчество || '',
    инн: value?.инн || '',
    кпп: value?.кпп || '',
    огрн: value?.огрн || '',
    огрнип: value?.огрнип || '',
    окпо: value?.окпо || '',
    адресРегистрации: value?.адресРегистрации || '',
    адресПечати: value?.адресПечати || '',
    паспортСерия: value?.паспортСерия || '',
    паспортНомер: value?.паспортНомер || '',
    паспортКемВыдан: value?.паспортКемВыдан || '',
    паспортДатаВыдачи: value?.паспортДатаВыдачи || '',
    паспортКодПодразделения: value?.паспортКодПодразделения || '',
    комментарий: value?.комментарий || '',
    bankAccounts: Array.isArray(value?.bankAccounts) && value?.bankAccounts.length
        ? value.bankAccounts.map((account, index) => ({
            id: account.id,
            name: account.name || (index === 0 ? 'Основной расчетный счет' : `Расчетный счет ${index + 1}`),
            bik: account.bik || '',
            bankName: account.bankName || '',
            correspondentAccount: account.correspondentAccount || '',
            settlementAccount: account.settlementAccount || '',
            isPrimary: Boolean(account.isPrimary),
            sortOrder: typeof account.sortOrder === 'number' ? account.sortOrder : index,
        }))
        : [createEmptyBankAccount(0)],
});

const Row = ({ label, children, mutedLabel }: { label: string; children: React.ReactNode; mutedLabel?: string }) => (
    <div className={styles.row}>
        <div className={styles.labelCol}>
            <Text as="div" className={styles.label}>{label}</Text>
            {mutedLabel ? <Text as="div" className={styles.labelMuted}>{mutedLabel}</Text> : null}
        </div>
        <div className={styles.fieldCol}>{children}</div>
    </div>
);

export function SupplierContragentModal({
    error,
    isOpen,
    loading = false,
    onClose,
    onSubmit,
    submitLabel,
    title,
    value,
}: SupplierContragentModalProps): JSX.Element | null {
    const [form, setForm] = useState<SupplierFormState>(() => createInitialState(value));
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setForm(createInitialState(value));
        setLocalError(null);
    }, [isOpen, value]);

    const type = normalizeSupplierContragentType(form.тип);
    const isOrganization = isSupplierOrganizationContragentType(type);
    const isEntrepreneur = type === 'Индивидуальный предприниматель';
    const isPerson = type === 'Физическое лицо';
    const showBankAccounts = isOrganization || isEntrepreneur;
    const registrationAddressLabel = isOrganization ? 'Адрес по ЕГРЮЛ' : isEntrepreneur ? 'Адрес по ЕГРИП' : 'Адрес по ФИАС';
    const printAddressLabel = isOrganization ? 'Юридический адрес' : 'Адрес';
    const printAddressMuted = 'для печати документов';

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (isOrganization) return Boolean(form.краткоеНазвание?.trim() || form.полноеНазвание?.trim());
        return Boolean(form.фамилия?.trim() && form.имя?.trim());
    }, [form, isOrganization, loading]);

    const setField = <K extends keyof SupplierFormState>(key: K, nextValue: SupplierFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: nextValue }));
    };

    const updateBankAccount = (index: number, patch: Partial<SupplierBankAccount>) => {
        setForm((prev) => ({
            ...prev,
            bankAccounts: prev.bankAccounts.map((account, accountIndex) => {
                if (accountIndex !== index) {
                    if (Object.prototype.hasOwnProperty.call(patch, 'isPrimary') && patch.isPrimary) {
                        return { ...account, isPrimary: false };
                    }
                    return account;
                }
                return { ...account, ...patch, sortOrder: index };
            }),
        }));
    };

    const addBankAccount = () => {
        setForm((prev) => ({
            ...prev,
            bankAccounts: prev.bankAccounts.concat(createEmptyBankAccount(prev.bankAccounts.length)),
        }));
    };

    const removeBankAccount = (index: number) => {
        setForm((prev) => {
            const nextAccounts = prev.bankAccounts.filter((_, accountIndex) => accountIndex !== index);
            if (nextAccounts.length === 0) {
                return { ...prev, bankAccounts: [createEmptyBankAccount(0)] };
            }
            return {
                ...prev,
                bankAccounts: nextAccounts.map((account, accountIndex) => ({
                    ...account,
                    isPrimary: accountIndex === 0 ? account.isPrimary || !nextAccounts.some((item) => item.isPrimary) : account.isPrimary,
                    sortOrder: accountIndex,
                })),
            };
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLocalError(null);

        if (!canSubmit) {
            setLocalError('Заполните обязательные поля');
            return;
        }

        await onSubmit({
            ...form,
            тип: type,
            bankAccounts: showBankAccounts ? form.bankAccounts : [],
        });
    };

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть" />
                <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.rows}>
                        <Row label="Тип контрагента">
                            <Select.Root value={type} onValueChange={(value) => setField('тип', normalizeSupplierContragentType(value))}>
                                <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {SUPPLIER_CONTRAGENT_TYPES.map((item) => (
                                        <Select.Item key={item} value={item}>{item}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Row>

                        {isOrganization ? (
                            <>
                                <Row label="Краткое название">
                                    <TextField.Root value={form.краткоеНазвание || ''} onChange={(e) => setField('краткоеНазвание', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Полное название">
                                    <TextArea value={form.полноеНазвание || ''} onChange={(e) => setField('полноеНазвание', e.target.value)} className={styles.textArea} resize="vertical" />
                                </Row>
                            </>
                        ) : (
                            <>
                                <Row label="Фамилия">
                                    <TextField.Root value={form.фамилия || ''} onChange={(e) => setField('фамилия', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Имя">
                                    <TextField.Root value={form.имя || ''} onChange={(e) => setField('имя', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Отчество">
                                    <TextField.Root value={form.отчество || ''} onChange={(e) => setField('отчество', e.target.value)} className={styles.textField} />
                                </Row>
                            </>
                        )}

                        <Row label="ИНН">
                            <TextField.Root value={form.инн || ''} onChange={(e) => setField('инн', e.target.value)} className={`${styles.textField} ${styles.shortField}`} />
                        </Row>

                        {isOrganization ? (
                            <Row label="КПП">
                                <TextField.Root value={form.кпп || ''} onChange={(e) => setField('кпп', e.target.value)} className={`${styles.textField} ${styles.shortField}`} />
                            </Row>
                        ) : null}

                        {isOrganization ? (
                            <Row label="ОГРН">
                                <TextField.Root value={form.огрн || ''} onChange={(e) => setField('огрн', e.target.value)} className={`${styles.textField} ${styles.shortField}`} />
                            </Row>
                        ) : null}

                        {isEntrepreneur ? (
                            <Row label="ОГРНИП">
                                <TextField.Root value={form.огрнип || ''} onChange={(e) => setField('огрнип', e.target.value)} className={`${styles.textField} ${styles.shortField}`} />
                            </Row>
                        ) : null}

                        <Row label="ОКПО">
                            <TextField.Root value={form.окпо || ''} onChange={(e) => setField('окпо', e.target.value)} className={`${styles.textField} ${styles.shortField}`} />
                        </Row>

                        {isPerson ? (
                            <Row label="Паспорт">
                                <div className={styles.passportGrid}>
                                    <div>
                                        <Text as="div" className={styles.subLabel}>Серия</Text>
                                        <TextField.Root value={form.паспортСерия || ''} onChange={(e) => setField('паспортСерия', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Text as="div" className={styles.subLabel}>Номер</Text>
                                        <TextField.Root value={form.паспортНомер || ''} onChange={(e) => setField('паспортНомер', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div className={styles.passportWide}>
                                        <Text as="div" className={styles.subLabel}>Кем выдан</Text>
                                        <TextField.Root value={form.паспортКемВыдан || ''} onChange={(e) => setField('паспортКемВыдан', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Text as="div" className={styles.subLabel}>Дата выдачи</Text>
                                        <TextField.Root type="date" value={form.паспортДатаВыдачи || ''} onChange={(e) => setField('паспортДатаВыдачи', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Text as="div" className={styles.subLabel}>Код подразделения</Text>
                                        <TextField.Root value={form.паспортКодПодразделения || ''} onChange={(e) => setField('паспортКодПодразделения', e.target.value)} className={styles.textField} />
                                    </div>
                                </div>
                            </Row>
                        ) : null}

                        <Row label={registrationAddressLabel}>
                            <div className={styles.addressField}>
                                <div className={styles.addressHint}><FiMapPin /> Указать</div>
                                <TextArea value={form.адресРегистрации || ''} onChange={(e) => setField('адресРегистрации', e.target.value)} className={styles.textArea} resize="vertical" />
                            </div>
                        </Row>
                        <Row label={printAddressLabel} mutedLabel={printAddressMuted}>
                            <TextArea value={form.адресПечати || ''} onChange={(e) => setField('адресПечати', e.target.value)} className={styles.textArea} resize="vertical" />
                        </Row>
                    </div>

                    {showBankAccounts ? (
                        <div className={styles.section}>
                            <Text as="div" className={styles.sectionTitle}>Расчетные счета</Text>
                            <div className={styles.bankAccountsList}>
                                {form.bankAccounts.map((account, index) => (
                                    <div key={`${account.id || 'new'}-${index}`} className={styles.bankCard}>
                                        <div className={styles.bankCardHeader}>
                                            <Text as="div" className={styles.bankCardTitle}>{account.name || `Расчетный счет ${index + 1}`}</Text>
                                            {form.bankAccounts.length > 1 ? (
                                                <button type="button" className={styles.iconButton} onClick={() => removeBankAccount(index)} aria-label="Удалить счет">
                                                    <FiTrash2 />
                                                </button>
                                            ) : null}
                                        </div>

                                        <div className={styles.bankGrid}>
                                            <div className={styles.bankGridWide}>
                                                <Text as="div" className={styles.subLabel}>Название</Text>
                                                <TextField.Root value={account.name} onChange={(e) => updateBankAccount(index, { name: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Text as="div" className={styles.subLabel}>БИК</Text>
                                                <TextField.Root value={account.bik || ''} onChange={(e) => updateBankAccount(index, { bik: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div className={styles.bankGridWide}>
                                                <Text as="div" className={styles.subLabel}>Банк</Text>
                                                <TextField.Root value={account.bankName || ''} onChange={(e) => updateBankAccount(index, { bankName: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Text as="div" className={styles.subLabel}>К/с</Text>
                                                <TextField.Root value={account.correspondentAccount || ''} onChange={(e) => updateBankAccount(index, { correspondentAccount: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Text as="div" className={styles.subLabel}>Р/с</Text>
                                                <TextField.Root value={account.settlementAccount || ''} onChange={(e) => updateBankAccount(index, { settlementAccount: e.target.value })} className={styles.textField} />
                                            </div>
                                        </div>

                                        <label className={styles.checkboxRow}>
                                            <input
                                                type="checkbox"
                                                className={styles.checkboxInput}
                                                checked={Boolean(account.isPrimary)}
                                                onChange={(e) => updateBankAccount(index, { isPrimary: e.target.checked })}
                                            />
                                            <span className={styles.checkboxText}>Основной</span>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <Button type="button" variant="surface" color="gray" highContrast className={styles.secondaryButton} onClick={addBankAccount}>
                                <FiPlus /> Добавить расчетный счет
                            </Button>
                        </div>
                    ) : null}

                    <div className={styles.section}>
                        <Text as="div" className={styles.sectionTitle}>Контакты</Text>
                        <div className={styles.rows}>
                            <Row label="Телефон">
                                <TextField.Root value={form.телефон || ''} onChange={(e) => setField('телефон', e.target.value)} className={styles.textField} />
                            </Row>
                            <Row label="Email">
                                <TextField.Root type="email" value={form.email || ''} onChange={(e) => setField('email', e.target.value)} className={styles.textField} />
                            </Row>
                            <Row label="Рейтинг">
                                <Select.Root value={String(form.рейтинг ?? 5)} onValueChange={(value) => setField('рейтинг', Number(value) || 5)}>
                                    <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="5">5</Select.Item>
                                        <Select.Item value="4">4</Select.Item>
                                        <Select.Item value="3">3</Select.Item>
                                        <Select.Item value="2">2</Select.Item>
                                        <Select.Item value="1">1</Select.Item>
                                        <Select.Item value="0">0</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Row>
                            <Row label="Комментарий">
                                <TextArea value={form.комментарий || ''} onChange={(e) => setField('комментарий', e.target.value)} className={styles.textArea} resize="vertical" />
                            </Row>
                        </div>
                    </div>

                    {error || localError ? (
                        <Box className={styles.errorBox}>
                            <Text size="2">{error || localError}</Text>
                        </Box>
                    ) : null}

                    <Flex justify="start" gap="3" className={styles.actions}>
                        <Button type="submit" variant="solid" color="gray" highContrast className={styles.primaryButton} disabled={!canSubmit || loading}>
                            {loading ? 'Сохранение...' : submitLabel}
                        </Button>
                        <Button type="button" variant="surface" color="gray" highContrast className={styles.secondaryButton} onClick={onClose} disabled={loading}>
                            Отменить
                        </Button>
                    </Flex>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
}
