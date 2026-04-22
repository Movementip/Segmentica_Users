import React from "react"

import { VAT_RATE_OPTIONS } from "@/lib/vat"
import { getOrderExecutionModeLabel } from "@/lib/orderModes"

import { RefreshButton } from "../../../RefreshButton/RefreshButton"
import { Button } from "../../../ui/button"
import { Card } from "../../../ui/card"
import { Checkbox } from "../../../ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import type { SettingsPayload } from "./types"
import styles from "./SystemSettingsCard.module.css"

type SystemSettingsCardProps = {
  settings: SettingsPayload
  canManageCoreSettings: boolean
  canManageSupplierAssortmentSetting: boolean
  canManageSupplierLeadTimeSetting: boolean
  canManageSettings: boolean
  saving: boolean
  rebuildingDerivedState: boolean
  notice: string | null
  error: string | null
  onSettingsChange: React.Dispatch<React.SetStateAction<SettingsPayload>>
  onReload: () => void
  onSave: () => void
  onRebuildDerivedState: () => void
}

export function SystemSettingsCard({
  settings,
  canManageCoreSettings,
  canManageSupplierAssortmentSetting,
  canManageSupplierLeadTimeSetting,
  canManageSettings,
  saving,
  rebuildingDerivedState,
  notice,
  error,
  onSettingsChange,
  onReload,
  onSave,
  onRebuildDerivedState,
}: SystemSettingsCardProps) {
  const selectedVatLabel =
    VAT_RATE_OPTIONS.find((option) => option.id === settings.defaultVatRateId)?.label ?? "Не выбрано"

  return (
    <Card className={styles.card}>
      <h2 className={styles.sectionTitle}>Новые заявки</h2>
      <p className={styles.sectionText}>
        Эти значения подставляются в формы создания и рекомендации. Существующие документы не переписываются автоматически.
      </p>

      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel}>Ставка НДС по умолчанию</label>
          <Select
            value={String(settings.defaultVatRateId)}
            onValueChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                defaultVatRateId: Number(value) || prev.defaultVatRateId,
              }))
            }
            disabled={!canManageCoreSettings}
          >
            <SelectTrigger className={styles.selectTrigger}>
              <SelectValue>{selectedVatLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VAT_RATE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className={styles.fieldHint}>
            Используется как начальная ставка НДС для новых позиций заявки и закупки, если в таковых НДС не указан. В заявках после выбора товара ставка может быть автоматически подставлена из карточки товара.
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel}>Режим заявок по умолчанию</label>
          <Select
            value={settings.defaultOrderExecutionMode}
            onValueChange={(value) =>
              onSettingsChange((prev) => ({
                ...prev,
                defaultOrderExecutionMode: value === "direct" ? "direct" : "warehouse",
              }))
            }
            disabled={!canManageCoreSettings}
          >
            <SelectTrigger className={styles.selectTrigger}>
              <SelectValue>{getOrderExecutionModeLabel(settings.defaultOrderExecutionMode)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="warehouse">{getOrderExecutionModeLabel("warehouse")}</SelectItem>
              <SelectItem value="direct">{getOrderExecutionModeLabel("direct")}</SelectItem>
            </SelectContent>
          </Select>
          <div className={styles.fieldHint}>
            Режим «Без склада» отключает контур склада и недостач, а позиции работают через закупку или ручное проведение.
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel}>Стоимость доставки</label>
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={settings.autoCalculateShipmentDeliveryCost}
              onCheckedChange={(checked) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  autoCalculateShipmentDeliveryCost: checked === true,
                }))
              }
              disabled={!canManageCoreSettings}
              className={styles.settingsCheckbox}
            />
            <span className={styles.checkboxText}>Рассчитывать стоимость доставки по тарифу ТК</span>
          </label>
          <div className={styles.fieldHint}>
            Если флаг выключен, стоимость доставки вводится вручную. Если включён, сайт сам пересчитывает её по тарифу ТК после сохранения позиций отгрузки.
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel}>Закупки по поставщикам</label>
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={settings.useSupplierAssortment}
              onCheckedChange={(checked) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  useSupplierAssortment: checked === true,
                  useSupplierLeadTime: checked === true ? prev.useSupplierLeadTime : false,
                }))
              }
              disabled={!canManageSupplierAssortmentSetting}
              className={styles.settingsCheckbox}
            />
            <span className={styles.checkboxText}>Учитывать ассортимент поставщиков</span>
          </label>
          <div className={styles.fieldHint}>
            Если флаг включён, создание закупки начнёт опираться на ассортимент поставщика: система будет подсказывать подходящих поставщиков, подставлять цены из их ассортимента и не даст сохранить закупку по товарам, которых у выбранного поставщика нет.
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel}>Сроки поставки</label>
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={settings.useSupplierLeadTime}
              onCheckedChange={(checked) =>
                onSettingsChange((prev) => ({
                  ...prev,
                  useSupplierLeadTime: checked === true && prev.useSupplierAssortment,
                }))
              }
              disabled={!settings.useSupplierAssortment || !canManageSupplierLeadTimeSetting}
              className={styles.settingsCheckbox}
            />
            <span className={styles.checkboxText}>Учитывать время поставки</span>
          </label>
          <div className={styles.fieldHint}>
            Работает вместе с ассортиментом поставщиков: рекомендации сортируются с учётом срока поставки, а в закупке дата поступления может подставляться по самому долгому сроку среди выбранных позиций.
          </div>
        </div>
      </div>

      {notice ? <div className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</div> : null}
      {error ? <div className={`${styles.notice} ${styles.noticeError}`}>{error}</div> : null}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="outline"
          className={styles.secondaryButton}
          onClick={onRebuildDerivedState}
          disabled={!canManageCoreSettings || rebuildingDerivedState}
        >
          {rebuildingDerivedState ? "Пересобираем..." : "Пересобрать данные"}
        </Button>

        <RefreshButton
          className={`${styles.secondaryButton} ${styles.refreshButton}`}
          isRefreshing={false}
          onClick={onReload}
        />

        <Button
          type="button"
          variant="default"
          className={styles.primaryButton}
          onClick={onSave}
          disabled={!canManageSettings || saving}
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </Card>
  )
}
