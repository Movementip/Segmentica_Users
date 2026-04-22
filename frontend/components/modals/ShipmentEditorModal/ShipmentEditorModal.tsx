import type { Dispatch, FormEvent, SetStateAction } from "react"

import { EntityModalShell } from "@/components/EntityModalShell/EntityModalShell"
import { EntityTableSurface } from "@/components/EntityDataTable/EntityDataTable"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import OrderSearchSelect from "@/components/ui/OrderSearchSelect/OrderSearchSelect"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  calculateVatAmountsFromLine,
  DEFAULT_VAT_RATE_ID,
  getVatRateOption,
  VAT_RATE_OPTIONS,
} from "@/lib/vat"

import styles from "./ShipmentEditorModal.module.css"

type SelectOption = {
  label: string
  value: string
}

type ShipmentEditorFormData = {
  заявка_id: number
  использовать_доставку: boolean
  без_учета_склада: boolean
  транспорт_id: number
  статус: string
  номер_отслеживания: string
  стоимость_доставки: number
}

type ShipmentEditorProduct = {
  id: number
  название: string
  артикул: string
  единица_измерения: string
}

type ManualShipmentPosition = {
  id?: number
  товар_id: number
  количество: number
  цена: number
  ндс_id: number
}

type OrderPositionPreview = {
  id: number
  товар_id: number
  количество: number
  цена: number
  ндс_id?: number
  ндс_название?: string
  ндс_ставка?: number
  сумма_без_ндс?: number
  сумма_ндс?: number
  сумма_всего?: number
  товар_название?: string
  товар_артикул?: string
  товар_единица_измерения?: string
}

type ShipmentEditorModalProps = {
  availableManualProducts: ShipmentEditorProduct[]
  canGoToOrder: boolean
  canSubmit: boolean
  editingId: number | null
  formData: ShipmentEditorFormData
  isOpen: boolean
  isSubmitting: boolean
  manualPositions: ManualShipmentPosition[]
  manualPositionsLoading: boolean
  manualPositionsTotal: number
  onAddManualPosition: () => void
  onClose: () => void
  onManualPositionChange: (
    index: number,
    field: keyof ManualShipmentPosition,
    value: string | number
  ) => void
  onOpenOrder: () => void
  onRemoveManualPosition: (index: number) => void
  onSubmit: (event: FormEvent) => void
  orderSelectOptions: SelectOption[]
  positionsPreviewTotal: number
  productsById: Map<number, ShipmentEditorProduct>
  selectedOrderPositions: OrderPositionPreview[]
  selectedOrderPositionsLoading: boolean
  setFormData: Dispatch<SetStateAction<ShipmentEditorFormData>>
  shipmentDeliveryAmount: number
  transportSelectOptions: SelectOption[]
  warehouseStockByProductId: Map<number, number>
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
  })
}

export function ShipmentEditorModal({
  availableManualProducts,
  canGoToOrder,
  canSubmit,
  editingId,
  formData,
  isOpen,
  isSubmitting,
  manualPositions,
  manualPositionsLoading,
  manualPositionsTotal,
  onAddManualPosition,
  onClose,
  onManualPositionChange,
  onOpenOrder,
  onRemoveManualPosition,
  onSubmit,
  orderSelectOptions,
  positionsPreviewTotal,
  productsById,
  selectedOrderPositions,
  selectedOrderPositionsLoading,
  setFormData,
  shipmentDeliveryAmount,
  transportSelectOptions,
  warehouseStockByProductId,
}: ShipmentEditorModalProps): JSX.Element | null {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <EntityModalShell
        className={styles.content}
        title={editingId ? "Редактировать отгрузку" : "Добавить отгрузку"}
        description="Заполните данные отгрузки и проверьте позиции перед сохранением."
        onClose={onClose}
        footer={(
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="outline"
              disabled={!formData.заявка_id || isSubmitting || !canGoToOrder}
              className={styles.orderButton}
              onClick={onOpenOrder}
            >
              Перейти к заявке
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button type="submit" form="shipment-editor-form" disabled={!canSubmit}>
              {isSubmitting ? (editingId ? "Сохранение..." : "Создание...") : (editingId ? "Сохранить" : "Добавить")}
            </Button>
          </div>
        )}
      >
        <form id="shipment-editor-form" onSubmit={onSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <Label htmlFor="shipment-order">Заявка</Label>
              <OrderSearchSelect
                value={formData.заявка_id ? String(formData.заявка_id) : ""}
                onValueChange={(nextValue) => setFormData((previous) => ({
                  ...previous,
                  заявка_id: nextValue ? Number(nextValue) : 0,
                  без_учета_склада: false,
                }))}
                options={orderSelectOptions}
                placeholder="Выберите заявку"
                disabled={isSubmitting}
              />
              <p className={styles.hint}>
                Если выбрать заявку, позиции будут подтянуты автоматически из нее.
              </p>
            </div>

            <div className={styles.field}>
              <Label htmlFor="shipment-status">Статус</Label>
              <Select
                value={formData.статус}
                items={[
                  { value: "в пути", label: "В пути" },
                  { value: "доставлено", label: "Доставлено" },
                  { value: "получено", label: "Получено" },
                  { value: "отменено", label: "Отменено" },
                ]}
                onValueChange={(value) => setFormData((previous) => ({
                  ...previous,
                  статус: String(value),
                }))}
              >
                <SelectTrigger id="shipment-status" />
                <SelectContent>
                  <SelectItem value="в пути">В пути</SelectItem>
                  <SelectItem value="доставлено">Доставлено</SelectItem>
                  <SelectItem value="получено">Получено</SelectItem>
                  <SelectItem value="отменено">Отменено</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.checkboxCard}>
                <span className={styles.checkboxRow}>
                  <Checkbox
                  checked={formData.использовать_доставку}
                  onCheckedChange={(checked) => setFormData((previous) => ({
                    ...previous,
                    использовать_доставку: checked === true,
                    транспорт_id: checked === true ? previous.транспорт_id : 0,
                    номер_отслеживания: checked === true ? previous.номер_отслеживания : "",
                    стоимость_доставки: checked === true ? previous.стоимость_доставки : 0,
                  }))}
                  className={styles.includeCheckbox}
                  disabled={isSubmitting}
                  />
                  <span className={styles.checkboxTitle}>Использовать доставку</span>
                </span>
                <span className={styles.checkboxHint}>
                  Если выключено, отгрузка будет оформлена без транспортной компании и стоимости доставки.
                </span>
              </label>
            </div>

            {!formData.заявка_id ? (
              <div className={styles.field}>
                <label className={styles.checkboxCard}>
                  <span className={styles.checkboxRow}>
                    <Checkbox
                    checked={formData.без_учета_склада}
                    onCheckedChange={(checked) => setFormData((previous) => ({
                      ...previous,
                      без_учета_склада: checked === true,
                    }))}
                    className={styles.includeCheckbox}
                    disabled={isSubmitting}
                    />
                    <span className={styles.checkboxTitle}>Без учета склада</span>
                  </span>
                  <span className={styles.checkboxHint}>
                    Самостоятельная отгрузка без проверки остатков и без списания со склада.
                  </span>
                </label>
              </div>
            ) : null}

            {formData.использовать_доставку ? (
              <>
                <div className={styles.field}>
                  <Label htmlFor="shipment-transport">Транспортная компания</Label>
                  <OrderSearchSelect
                    value={formData.транспорт_id ? String(formData.транспорт_id) : ""}
                    onValueChange={(nextValue) => setFormData((previous) => ({
                      ...previous,
                      транспорт_id: nextValue ? Number(nextValue) || 0 : 0,
                    }))}
                    options={transportSelectOptions}
                    placeholder="Выберите ТК"
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.field}>
                  <Label htmlFor="shipment-track">Номер отслеживания</Label>
                  <Input
                    id="shipment-track"
                    value={formData.номер_отслеживания}
                    onChange={(event) => setFormData((previous) => ({
                      ...previous,
                      номер_отслеживания: event.target.value,
                    }))}
                    placeholder="TRACK-001"
                  />
                </div>

                <div className={styles.field}>
                  <Label htmlFor="shipment-cost">Стоимость доставки</Label>
                  <Input
                    id="shipment-cost"
                    value={String(formData.стоимость_доставки ?? "")}
                    onChange={(event) => {
                      const value = event.target.value
                      const next = value === "" ? 0 : Number(value)
                      setFormData((previous) => ({
                        ...previous,
                        стоимость_доставки: Number.isFinite(next) ? next : previous.стоимость_доставки,
                      }))
                    }}
                    placeholder="400.00"
                    inputMode="decimal"
                  />
                </div>
              </>
            ) : null}
          </div>

          <section className={styles.positionsSection}>
            <div className={styles.positionsHeader}>
              <div>
                <h3 className={styles.positionsTitle}>Позиции отгрузки</h3>
                {formData.заявка_id ? (
                  <p className={styles.hint}>Состав подтягивается из выбранной заявки.</p>
                ) : (
                  <p className={styles.hint}>
                    {formData.без_учета_склада
                      ? "Выберите товары вручную: это будет самостоятельная отгрузка без учета склада."
                      : "Выберите товары вручную: в списке доступны только товары, которые есть на складе."}
                  </p>
                )}
              </div>

              {!formData.заявка_id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onAddManualPosition}
                  disabled={manualPositionsLoading}
                  className={styles.surfaceActionButton}
                >
                  Добавить позицию
                </Button>
              ) : null}
            </div>

            {formData.заявка_id ? (
              <>
                {selectedOrderPositionsLoading ? (
                  <p className={styles.emptyMessage}>Загружаем состав отгрузки...</p>
                ) : selectedOrderPositions.length === 0 ? (
                  <p className={styles.emptyMessage}>
                    Для этой отгрузки сейчас нет позиций или они недоступны для просмотра.
                  </p>
                ) : (
                  <>
                    <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                      <Table className={styles.previewTable}>
                        <colgroup>
                          <col className={styles.previewColName} />
                          <col className={styles.previewColUnit} />
                          <col className={styles.previewColQty} />
                          <col className={styles.previewColPrice} />
                          <col className={styles.previewColNet} />
                          <col className={styles.previewColVat} />
                          <col className={styles.previewColTax} />
                          <col className={styles.previewColTotal} />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead>Ед.изм</TableHead>
                            <TableHead>Кол-во</TableHead>
                            <TableHead className={styles.textRight}>Цена, ₽</TableHead>
                            <TableHead className={styles.textRight}>Сумма без НДС, ₽</TableHead>
                            <TableHead>НДС</TableHead>
                            <TableHead className={styles.textRight}>Сумма НДС, ₽</TableHead>
                            <TableHead className={styles.textRight}>Всего, ₽</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrderPositions.map((position) => {
                            const vatOption = getVatRateOption(position.ндс_id)
                            const fallbackAmounts = calculateVatAmountsFromLine(
                              position.количество,
                              position.цена,
                              position.ндс_ставка ?? vatOption.rate
                            )

                            return (
                              <TableRow key={position.id}>
                                <TableCell>
                                  <div className={styles.primaryText}>
                                    {position.товар_название || `Товар #${position.товар_id}`}
                                  </div>
                                  {position.товар_артикул ? (
                                    <div className={styles.secondaryText}>{position.товар_артикул}</div>
                                  ) : null}
                                </TableCell>
                                <TableCell>{position.товар_единица_измерения || "шт"}</TableCell>
                                <TableCell>{position.количество}</TableCell>
                                <TableCell className={styles.textRight}>{formatCurrency(position.цена || 0)}</TableCell>
                                <TableCell className={styles.textRight}>
                                  {formatCurrency(position.сумма_без_ндс ?? fallbackAmounts.net)}
                                </TableCell>
                                <TableCell>{position.ндс_название || vatOption.label}</TableCell>
                                <TableCell className={styles.textRight}>
                                  {formatCurrency(position.сумма_ндс ?? fallbackAmounts.tax)}
                                </TableCell>
                                <TableCell className={styles.textRight}>
                                  {formatCurrency(position.сумма_всего ?? fallbackAmounts.total)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </EntityTableSurface>

                    <div className={styles.totalAmount}>
                      <span>Стоимость доставки: {formatCurrency(shipmentDeliveryAmount)}</span>
                      <strong>Итого: {formatCurrency(positionsPreviewTotal + shipmentDeliveryAmount)}</strong>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {manualPositionsLoading ? (
                  <p className={styles.emptyMessage}>Загружаем состав самостоятельной отгрузки...</p>
                ) : null}

                {!manualPositionsLoading ? (
                  <>
                    <div className={styles.positionsTable}>
                      {manualPositions.length > 0 ? (
                      <div className={styles.positionHeaderRow}>
                        <span>Товар</span>
                        <span>Ед.изм</span>
                        <span>Кол-во</span>
                        <span>Цена, ₽</span>
                        <span>НДС</span>
                        <span className={styles.textRight}>Всего, ₽</span>
                        <span />
                      </div>
                      ) : null}

                      <div className={styles.positionsList}>
                        {manualPositions.map((position, index) => {
                          const selectedProduct = productsById.get(position.товар_id)
                          const total = calculateVatAmountsFromLine(
                            position.количество,
                            position.цена,
                            getVatRateOption(position.ндс_id).rate
                          ).total
                          const productOptions = availableManualProducts.map((product) => ({
                            value: String(product.id),
                            label: `${product.артикул} - ${product.название}${!formData.без_учета_склада ? ` · в наличии: ${warehouseStockByProductId.get(product.id) || 0}` : ""}`,
                          }))

                          return (
                            <div key={position.id ?? `manual-${index}`} className={styles.positionRow}>
                              <OrderSearchSelect
                                value={position.товар_id ? String(position.товар_id) : ""}
                                onValueChange={(nextValue) => onManualPositionChange(index, "товар_id", nextValue ? Number(nextValue) : 0)}
                                options={productOptions}
                                placeholder="Выберите товар"
                                compact
                                inputClassName={styles.positionSearchSelectInput}
                                menuClassName={styles.positionSearchSelectMenu}
                              />

                              <span className={styles.unitValue}>
                                {selectedProduct?.единица_измерения || "шт"}
                              </span>

                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={String(position.количество)}
                                onChange={(event) => onManualPositionChange(index, "количество", event.target.value)}
                                className={styles.qtyField}
                              />

                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={String(position.цена)}
                                onChange={(event) => onManualPositionChange(index, "цена", event.target.value)}
                                className={styles.priceField}
                              />

                              <Select
                                value={String(position.ндс_id || DEFAULT_VAT_RATE_ID)}
                                items={VAT_RATE_OPTIONS.map((option) => ({
                                  value: String(option.id),
                                  label: option.label,
                                }))}
                                onValueChange={(nextValue) => onManualPositionChange(index, "ндс_id", Number(nextValue) || DEFAULT_VAT_RATE_ID)}
                              >
                                <SelectTrigger className={styles.vatField} />
                                <SelectContent>
                                  {VAT_RATE_OPTIONS.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <strong className={styles.positionTotal}>{formatCurrency(total)}</strong>

                              <Button
                                type="button"
                                variant="outline"
                                className={styles.removePositionButton}
                                onClick={() => onRemoveManualPosition(index)}
                                disabled={manualPositions.length === 1}
                              >
                                ×
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className={styles.totalAmount}>
                      <span>Стоимость доставки: {formatCurrency(shipmentDeliveryAmount)}</span>
                      <strong>Итого: {formatCurrency(manualPositionsTotal + shipmentDeliveryAmount)}</strong>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        </form>
      </EntityModalShell>
    </Dialog>
  )
}
