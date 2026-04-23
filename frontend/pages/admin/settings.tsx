import React, { useCallback, useEffect, useState } from 'react';
import { withLayout } from '../../layout';
import { SystemSettingsCard } from '../../components/admin/settings/SystemSettingsCard/SystemSettingsCard';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { VAT_RATE_OPTIONS } from '../../lib/vat';
import type { SettingsPayload } from '../../types/pages/settings';
import styles from './AdminSettings.module.css';

const INITIAL_VAT_RATE_ID = VAT_RATE_OPTIONS.find((item) => item.isDefault)?.id || 5;

function AdminSettingsPage(): JSX.Element {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rebuildingDerivedState, setRebuildingDerivedState] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [settings, setSettings] = useState<SettingsPayload>({
        defaultVatRateId: INITIAL_VAT_RATE_ID,
        defaultOrderExecutionMode: 'warehouse',
        autoCalculateShipmentDeliveryCost: false,
        useSupplierAssortment: false,
        useSupplierLeadTime: false,
    });

    const canManageCoreSettings = Boolean(user?.permissions?.includes('admin.settings'));
    const canManageSupplierAssortmentSetting = canManageCoreSettings || Boolean(user?.permissions?.includes('admin.settings.supplier_assortment.manage'));
    const canManageSupplierLeadTimeSetting = canManageCoreSettings || Boolean(user?.permissions?.includes('admin.settings.supplier_lead_time.manage'));
    const canManageSettings = canManageCoreSettings || canManageSupplierAssortmentSetting || canManageSupplierLeadTimeSetting;

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
                useSupplierAssortment: Boolean((data as any)?.useSupplierAssortment),
                useSupplierLeadTime: Boolean((data as any)?.useSupplierLeadTime),
            });
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить системные настройки');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading || !canManageSettings) return;
        void loadSettings();
    }, [authLoading, canManageSettings, loadSettings]);

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

    const handleRebuildDerivedState = async () => {
        try {
            setRebuildingDerivedState(true);
            setError(null);
            setNotice(null);

            const response = await fetch('/api/admin/rebuild-derived-state', {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось пересобрать производные данные');
            }

            const ordersProcessed = Number((data as any)?.ordersProcessed) || 0;
            const purchasesProcessed = Number((data as any)?.purchasesProcessed) || 0;
            const shipmentsProcessed = Number((data as any)?.shipmentsProcessed) || 0;
            setNotice(
                `Производные данные пересобраны. Заявок: ${ordersProcessed}, закупок: ${purchasesProcessed}, отгрузок: ${shipmentsProcessed}.`
            );
        } catch (rebuildError) {
            setError(rebuildError instanceof Error ? rebuildError.message : 'Не удалось пересобрать производные данные');
        } finally {
            setRebuildingDerivedState(false);
        }
    };

    if (authLoading || loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canManageSettings) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Настройки системы</h1>
                    <div className={styles.subtitle}>Глобальные параметры для новых заявок, закупок, НДС и поведения отгрузок.</div>
                </div>
            </div>

            <div className={styles.grid}>
                <SystemSettingsCard
                    settings={settings}
                    canManageCoreSettings={canManageCoreSettings}
                    canManageSupplierAssortmentSetting={canManageSupplierAssortmentSetting}
                    canManageSupplierLeadTimeSetting={canManageSupplierLeadTimeSetting}
                    canManageSettings={canManageSettings}
                    saving={saving}
                    rebuildingDerivedState={rebuildingDerivedState}
                    notice={notice}
                    error={error}
                    onSettingsChange={setSettings}
                    onReload={() => void loadSettings()}
                    onSave={() => void handleSave()}
                    onRebuildDerivedState={() => void handleRebuildDerivedState()}
                />
            </div>
        </div>
    );
}

export default withLayout(AdminSettingsPage);
