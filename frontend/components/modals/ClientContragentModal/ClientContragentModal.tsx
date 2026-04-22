import React, { useEffect, useMemo, useState } from 'react';
import { FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi';

import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { cn } from '../../../lib/utils';
import {
    CLIENT_CONTRAGENT_TYPES,
    isForeignContragentType,
    isOrganizationContragentType,
    normalizeClientContragentType,
    type ClientBankAccount,
    type ClientContragent,
    type ClientContragentPayload,
} from '../../../lib/clientContragents';
import styles from '../ClientContragentModal/ClientContragentModal.module.css';

type ClientContragentModalProps = {
    error?: string | null;
    isOpen: boolean;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (payload: ClientContragentPayload) => Promise<void> | void;
    submitLabel: string;
    title: string;
    value?: Partial<ClientContragent> | null;
};

type ClientFormState = Omit<ClientContragentPayload, 'bankAccounts'> & {
    bankAccounts: ClientBankAccount[];
};

const createEmptyBankAccount = (index = 0): ClientBankAccount => ({
    name: index === 0 ? 'Основной расчетный счет' : `Расчетный счет ${index + 1}`,
    bik: '',
    bankName: '',
    correspondentAccount: '',
    settlementAccount: '',
    isPrimary: index === 0,
    sortOrder: index,
});

const createInitialState = (value?: Partial<ClientContragent> | null): ClientFormState => ({
    название: value?.название || '',
    телефон: value?.телефон || '',
    email: value?.email || '',
    адрес: value?.адрес || '',
    тип: normalizeClientContragentType(value?.тип),
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

const Row = ({
    label,
    children,
    mutedLabel,
}: {
    label: string;
    children: React.ReactNode;
    mutedLabel?: string;
}) => (
    <div className={styles.row}>
        <div className={styles.labelCol}>
            <div className={styles.label}>{label}</div>
            {mutedLabel ? <div className={styles.labelMuted}>{mutedLabel}</div> : null}
        </div>
        <div className={styles.fieldCol}>{children}</div>
    </div>
);

export function ClientContragentModal({
    error,
    isOpen,
    loading = false,
    onClose,
    onSubmit,
    submitLabel,
    title,
    value,
}: ClientContragentModalProps): JSX.Element | null {
    const [form, setForm] = useState<ClientFormState>(() => createInitialState(value));
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setForm(createInitialState(value));
        setLocalError(null);
    }, [isOpen, value]);

    const type = normalizeClientContragentType(form.тип);
    const isForeign = isForeignContragentType(type);
    const isOrganization = isOrganizationContragentType(type);
    const showBankAccounts = type === 'Организация' || type === 'Индивидуальный предприниматель' || type === 'Глава КФХ';
    const showPassport = type === 'Физическое лицо';
    const showKpp = isOrganization;
    const showOgrn = isOrganization;
    const showOgrnip = type === 'Индивидуальный предприниматель' || type === 'Глава КФХ';
    const registrationAddressLabel = isOrganization ? 'Адрес по ЕГРЮЛ' : type === 'Индивидуальный предприниматель' ? 'Адрес по ЕГРИП' : 'Адрес по ФИАС';
    const printAddressLabel = isOrganization ? 'Юридический адрес' : 'Адрес';
    const printAddressMuted = 'для печати документов';

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (isForeign) return Boolean(form.название?.trim());
        if (isOrganization) return Boolean(form.краткоеНазвание?.trim() || form.полноеНазвание?.trim());
        return Boolean(form.фамилия?.trim() && form.имя?.trim());
    }, [form, isForeign, isOrganization, loading]);

    const setField = <K extends keyof ClientFormState>(key: K, nextValue: ClientFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: nextValue }));
    };

    const updateBankAccount = (index: number, patch: Partial<ClientBankAccount>) => {
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
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <EntityModalShell className={styles.modalContent} onClose={onClose} title={title}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.rows}>
                        <Row label="Тип контрагента">
                            <Select value={type} onValueChange={(value) => setField('тип', normalizeClientContragentType(value))}>
                                <SelectTrigger className={styles.selectTrigger}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CLIENT_CONTRAGENT_TYPES.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Row>

                        {isForeign ? (
                            <Row label="Название">
                                <Textarea
                                    value={form.название || ''}
                                    onChange={(e) => setField('название', e.target.value)}
                                    className={styles.textArea}
                                />
                            </Row>
                        ) : isOrganization ? (
                            <>
                                <Row label="Краткое название">
                                    <Input value={form.краткоеНазвание || ''} onChange={(e) => setField('краткоеНазвание', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Полное название">
                                    <Textarea value={form.полноеНазвание || ''} onChange={(e) => setField('полноеНазвание', e.target.value)} className={styles.textArea} />
                                </Row>
                            </>
                        ) : (
                            <>
                                <Row label="Фамилия">
                                    <Input value={form.фамилия || ''} onChange={(e) => setField('фамилия', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Имя">
                                    <Input value={form.имя || ''} onChange={(e) => setField('имя', e.target.value)} className={styles.textField} />
                                </Row>
                                <Row label="Отчество">
                                    <Input value={form.отчество || ''} onChange={(e) => setField('отчество', e.target.value)} className={styles.textField} />
                                </Row>
                            </>
                        )}

                        {!isForeign ? (
                            <>
                                <Row label="ИНН">
                                    <Input value={form.инн || ''} onChange={(e) => setField('инн', e.target.value)} className={cn(styles.textField, styles.shortField)} />
                                </Row>

                                {showKpp ? (
                                    <Row label="КПП">
                                        <Input value={form.кпп || ''} onChange={(e) => setField('кпп', e.target.value)} className={cn(styles.textField, styles.shortField)} />
                                    </Row>
                                ) : null}

                                {showOgrn ? (
                                    <Row label="ОГРН">
                                        <Input value={form.огрн || ''} onChange={(e) => setField('огрн', e.target.value)} className={cn(styles.textField, styles.shortField)} />
                                    </Row>
                                ) : null}

                                {showOgrnip ? (
                                    <Row label="ОГРНИП">
                                        <Input value={form.огрнип || ''} onChange={(e) => setField('огрнип', e.target.value)} className={cn(styles.textField, styles.shortField)} />
                                    </Row>
                                ) : null}

                                <Row label="ОКПО">
                                    <Input value={form.окпо || ''} onChange={(e) => setField('окпо', e.target.value)} className={cn(styles.textField, styles.shortField)} />
                                </Row>
                            </>
                        ) : null}

                        {showPassport ? (
                            <Row label="Паспорт">
                                <div className={styles.passportGrid}>
                                    <div>
                                        <Label className={styles.subLabel}>Серия</Label>
                                        <Input value={form.паспортСерия || ''} onChange={(e) => setField('паспортСерия', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Label className={styles.subLabel}>Номер</Label>
                                        <Input value={form.паспортНомер || ''} onChange={(e) => setField('паспортНомер', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div className={styles.passportWide}>
                                        <Label className={styles.subLabel}>Кем выдан</Label>
                                        <Input value={form.паспортКемВыдан || ''} onChange={(e) => setField('паспортКемВыдан', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Label className={styles.subLabel}>Дата выдачи</Label>
                                        <Input type="date" value={form.паспортДатаВыдачи || ''} onChange={(e) => setField('паспортДатаВыдачи', e.target.value)} className={styles.textField} />
                                    </div>
                                    <div>
                                        <Label className={styles.subLabel}>Код подразделения</Label>
                                        <Input value={form.паспортКодПодразделения || ''} onChange={(e) => setField('паспортКодПодразделения', e.target.value)} className={styles.textField} />
                                    </div>
                                </div>
                            </Row>
                        ) : null}

                        {!isForeign ? (
                            <>
                                <Row label={registrationAddressLabel}>
                                    <div className={styles.addressField}>
                                        <div className={styles.addressHint}>
                                            <FiMapPin />
                                            <span>Указать</span>
                                        </div>
                                        <Textarea value={form.адресРегистрации || ''} onChange={(e) => setField('адресРегистрации', e.target.value)} className={styles.textArea} />
                                    </div>
                                </Row>
                                <Row label={printAddressLabel} mutedLabel={printAddressMuted}>
                                    <Textarea value={form.адресПечати || ''} onChange={(e) => setField('адресПечати', e.target.value)} className={styles.textArea} />
                                </Row>
                            </>
                        ) : null}
                    </div>

                    {showBankAccounts ? (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>Расчетные счета</div>
                            <div className={styles.bankAccountsList}>
                                {form.bankAccounts.map((account, index) => (
                                    <div key={`${account.id || 'new'}-${index}`} className={styles.bankCard}>
                                        <div className={styles.bankCardHeader}>
                                            <div className={styles.bankCardTitle}>{account.name || `Расчетный счет ${index + 1}`}</div>
                                            {form.bankAccounts.length > 1 ? (
                                                <button type="button" className={styles.iconButton} onClick={() => removeBankAccount(index)} aria-label="Удалить счет">
                                                    <FiTrash2 />
                                                </button>
                                            ) : null}
                                        </div>

                                        <div className={styles.bankGrid}>
                                            <div className={styles.bankGridWide}>
                                                <Label className={styles.subLabel}>Название</Label>
                                                <Input value={account.name} onChange={(e) => updateBankAccount(index, { name: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Label className={styles.subLabel}>БИК</Label>
                                                <Input value={account.bik || ''} onChange={(e) => updateBankAccount(index, { bik: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div className={styles.bankGridWide}>
                                                <Label className={styles.subLabel}>Банк</Label>
                                                <Input value={account.bankName || ''} onChange={(e) => updateBankAccount(index, { bankName: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Label className={styles.subLabel}>К/с</Label>
                                                <Input value={account.correspondentAccount || ''} onChange={(e) => updateBankAccount(index, { correspondentAccount: e.target.value })} className={styles.textField} />
                                            </div>
                                            <div>
                                                <Label className={styles.subLabel}>Р/с</Label>
                                                <Input value={account.settlementAccount || ''} onChange={(e) => updateBankAccount(index, { settlementAccount: e.target.value })} className={styles.textField} />
                                            </div>
                                        </div>

                                        <label className={styles.checkboxRow}>
                                            <Checkbox
                                                checked={Boolean(account.isPrimary)}
                                                onCheckedChange={(checked) => updateBankAccount(index, { isPrimary: checked === true })}
                                            />
                                            <span className={styles.checkboxText}>Основной</span>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <Button type="button" variant="outline" className={styles.secondaryButton} onClick={addBankAccount}>
                                <FiPlus />
                                Добавить расчетный счет
                            </Button>
                        </div>
                    ) : null}

                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Контакты</div>
                        <div className={styles.rows}>
                            <Row label="Телефон">
                                <Input value={form.телефон || ''} onChange={(e) => setField('телефон', e.target.value)} className={styles.textField} />
                            </Row>
                            <Row label="Email">
                                <Input type="email" value={form.email || ''} onChange={(e) => setField('email', e.target.value)} className={styles.textField} />
                            </Row>
                            <Row label="Комментарий">
                                <Textarea value={form.комментарий || ''} onChange={(e) => setField('комментарий', e.target.value)} className={styles.textArea} />
                            </Row>
                        </div>
                    </div>

                    {error || localError ? <div className={styles.errorBox}>{error || localError}</div> : null}

                    <div className={styles.actions}>
                        <Button type="submit" variant="default" className={styles.primaryButton} disabled={!canSubmit || loading}>
                            {loading ? 'Сохранение...' : submitLabel}
                        </Button>
                        <Button type="button" variant="outline" className={styles.secondaryButton} onClick={onClose} disabled={loading}>
                            Отменить
                        </Button>
                    </div>
                </form>
            </EntityModalShell>
        </Dialog>
    );
}
