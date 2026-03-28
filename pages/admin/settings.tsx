import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Select, Text } from '@radix-ui/themes';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { VAT_RATE_OPTIONS, getVatRateOption } from '../../lib/vat';
import { getOrderExecutionModeLabel, type OrderExecutionMode } from '../../lib/orderModes';
import styles from './AdminSettings.module.css';

type SettingsPayload = {
    defaultVatRateId: number;
    defaultOrderExecutionMode: OrderExecutionMode;
    autoCalculateShipmentDeliveryCost: boolean;
};

const INITIAL_VAT_RATE_ID = VAT_RATE_OPTIONS.find((item) => item.isDefault)?.id || 5;

function AdminSettingsPage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [settings, setSettings] = useState<SettingsPayload>({
        defaultVatRateId: INITIAL_VAT_RATE_ID,
        defaultOrderExecutionMode: 'warehouse',
        autoCalculateShipmentDeliveryCost: false,
    });

    const isDirector = Boolean(user?.roles?.includes('director'));

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/admin/settings');
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось загрузить системные настройки');
            }

            setSettings({
                defaultVatRateId: Number((data as any)?.defaultVatRateId) || INITIAL_VAT_RATE_ID,
                defaultOrderExecutionMode: ((data as any)?.defaultOrderExecutionMode === 'direct' ? 'direct' : 'warehouse'),
                autoCalculateShipmentDeliveryCost: Boolean((data as any)?.autoCalculateShipmentDeliveryCost),
            });
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить системные настройки');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading || !isDirector) return;
        void loadSettings();
    }, [authLoading, isDirector, loadSettings]);

    const currentVat = useMemo(
        () => getVatRateOption(settings.defaultVatRateId),
        [settings.defaultVatRateId]
    );

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось сохранить системные настройки');
            }

            setNotice('Системные настройки сохранены.');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить системные настройки');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!isDirector) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Настройки системы</h1>
                    <div className={styles.subtitle}>Глобальные параметры для новых заявок, НДС и поведения отгрузок.</div>
                </div>
            </div>

            <div className={styles.grid}>
                <section className={styles.card}>
                    <h2 className={styles.sectionTitle}>Новые заявки</h2>
                    <p className={styles.sectionText}>
                        Эти значения подставляются в формы создания. Существующие документы не переписываются.
                    </p>

                    <div className={styles.formGrid}>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                            <label className={styles.fieldLabel}>Ставка НДС по умолчанию</label>
                            <Select.Root
                                value={String(settings.defaultVatRateId)}
                                onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultVatRateId: Number(value) || prev.defaultVatRateId }))}
                            >
                                <Select.Trigger className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    {VAT_RATE_OPTIONS.map((option) => (
                                        <Select.Item key={option.id} value={String(option.id)}>
                                            {option.label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                            <div className={styles.fieldHint}>
                                Будет использоваться для новых позиций заявки и закупки, если пользователь не выберет ставку вручную.
                            </div>
                        </div>

                        <div className={`${styles.field} ${styles.fieldWide}`}>
                            <label className={styles.fieldLabel}>Режим заявок по умолчанию</label>
                            <Select.Root
                                value={settings.defaultOrderExecutionMode}
                                onValueChange={(value) => setSettings((prev) => ({
                                    ...prev,
                                    defaultOrderExecutionMode: value === 'direct' ? 'direct' : 'warehouse',
                                }))}
                            >
                                <Select.Trigger className={styles.selectTrigger} />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="warehouse">{getOrderExecutionModeLabel('warehouse')}</Select.Item>
                                    <Select.Item value="direct">{getOrderExecutionModeLabel('direct')}</Select.Item>
                                </Select.Content>
                            </Select.Root>
                            <div className={styles.fieldHint}>
                                Режим «Без склада» отключает контур склада и недостач, а позиции работают через закупку или ручное проведение.
                            </div>
                        </div>

                        <div className={`${styles.field} ${styles.fieldWide}`}>
                            <label className={styles.fieldLabel}>Стоимость доставки</label>
                            <label className={styles.checkboxRow}>
                                <input
                                    type="checkbox"
                                    className={styles.checkboxInput}
                                    checked={settings.autoCalculateShipmentDeliveryCost}
                                    onChange={(event) => setSettings((prev) => ({
                                        ...prev,
                                        autoCalculateShipmentDeliveryCost: event.target.checked,
                                    }))}
                                />
                                <span className={styles.checkboxText}>Рассчитывать стоимость доставки по тарифу ТК</span>
                            </label>
                            <div className={styles.fieldHint}>
                                Если флаг выключен, стоимость доставки вводится вручную. Это значение должно оставаться в отгрузке без пересчёта триггером.
                            </div>
                        </div>
                    </div>

                    {notice ? <div className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</div> : null}
                    {error ? <div className={`${styles.notice} ${styles.noticeError}`}>{error}</div> : null}

                    <div className={styles.actions}>
                        <Button variant="surface" color="gray" highContrast className={styles.surfaceButton} onClick={() => void loadSettings()}>
                            Обновить
                        </Button>
                        <Button variant="solid" color="gray" highContrast className={styles.solidButton} onClick={handleSave} loading={saving}>
                            Сохранить
                        </Button>
                    </div>
                </section>

                <aside className={styles.card}>
                    <h2 className={styles.sectionTitle}>Сводка</h2>
                    <p className={styles.sectionText}>
                        Короткая шпаргалка по текущим системным значениям для новых документов и отгрузок.
                    </p>

                    <div className={styles.metrics}>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>НДС по умолчанию</div>
                            <div className={styles.metricValue}>{currentVat.label}</div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>Режим новых заявок</div>
                            <div className={styles.metricValue}>{getOrderExecutionModeLabel(settings.defaultOrderExecutionMode)}</div>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>Стоимость доставки</div>
                            <div className={styles.metricValue}>
                                {settings.autoCalculateShipmentDeliveryCost ? 'По тарифу ТК' : 'Вводится вручную'}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withLayout(AdminSettingsPage);
