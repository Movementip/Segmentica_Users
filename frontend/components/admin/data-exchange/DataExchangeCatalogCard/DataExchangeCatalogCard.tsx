import React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"

import { Checkbox } from "../../../ui/checkbox"
import { Button } from "../../../ui/button"
import { Card } from "../../../ui/card"
import {
  canExportCatalog,
  canImportCatalog,
  type DataExchangeCatalogGroup,
  type DataExchangeCatalogKey,
} from "../../../../lib/dataExchangeConfig"
import styles from "./DataExchangeCatalogCard.module.css"

type CatalogGroupView = {
  key: DataExchangeCatalogGroup
  title: string
  description: string
  items: Array<{
    key: DataExchangeCatalogKey
    label: string
  }>
}

type DataExchangeCatalogCardProps = {
  permissions: string[]
  selectedCatalogs: DataExchangeCatalogKey[]
  availableCatalogKeys: DataExchangeCatalogKey[]
  catalogsByGroup: CatalogGroupView[]
  getCatalogAccessLabel: (canExportItem: boolean, canImportItem: boolean) => string
  onSelectAll: () => void
  onClearAll: () => void
  onToggleCatalog: (catalogKey: DataExchangeCatalogKey) => void
  onSelectCatalogGroup: (catalogKeys: DataExchangeCatalogKey[]) => void
  onClearCatalogGroup: (catalogKeys: DataExchangeCatalogKey[]) => void
}

export function DataExchangeCatalogCard({
  permissions,
  selectedCatalogs,
  availableCatalogKeys,
  catalogsByGroup,
  getCatalogAccessLabel,
  onSelectAll,
  onClearAll,
  onToggleCatalog,
  onSelectCatalogGroup,
  onClearCatalogGroup,
}: DataExchangeCatalogCardProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.content}>
        <div>
          <h2 className={styles.sectionTitle}>Разделы</h2>
          <p className={styles.sectionText}>
            Выберите разделы, которые хотите выгрузить или загрузить.
          </p>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            className={styles.actionButton}
            onClick={onSelectAll}
            disabled={!availableCatalogKeys.length}
          >
            Выбрать все
          </Button>
          <Button
            type="button"
            variant="outline"
            className={styles.actionButton}
            onClick={onClearAll}
            disabled={!selectedCatalogs.length}
          >
            Очистить
          </Button>
        </div>

        <div className={styles.catalogList}>
          {catalogsByGroup.map((group) => {
            const groupCatalogKeys = group.items.map((item) => item.key)
            const selectedInGroup = groupCatalogKeys.filter((catalogKey) =>
              selectedCatalogs.includes(catalogKey)
            )
            const allSelected =
              groupCatalogKeys.length > 0 && selectedInGroup.length === groupCatalogKeys.length
            const partiallySelected = selectedInGroup.length > 0 && !allSelected

            return (
              <div key={group.key} className={styles.catalogGroup}>
                <div className={styles.catalogGroupHeader}>
                  <button
                    type="button"
                    className={styles.groupCheckboxRow}
                    onClick={() => {
                      if (allSelected) {
                        onClearCatalogGroup(groupCatalogKeys)
                      } else {
                        onSelectCatalogGroup(groupCatalogKeys)
                      }
                    }}
                  >
                    <span
                      className={`${styles.groupCheckbox} ${allSelected || partiallySelected ? styles.groupCheckboxActive : ""}`}
                    >
                      {allSelected ? <CheckIcon /> : partiallySelected ? <MinusIcon /> : null}
                    </span>
                    <span className={styles.groupCheckboxText}>{group.title}</span>
                  </button>
                  <div className={styles.catalogGroupText}>{group.description}</div>
                </div>

                <div className={styles.catalogGroupList}>
                  {group.items.map((catalog) => {
                    const checked = selectedCatalogs.includes(catalog.key)
                    const canExportItem = canExportCatalog(permissions, catalog.key)
                    const canImportItem = canImportCatalog(permissions, catalog.key)
                    const isDisabled = !canExportItem && !canImportItem

                    return (
                      <label
                        key={catalog.key}
                        className={`${styles.catalogOption} ${isDisabled ? styles.catalogOptionDisabled : ""}`}
                      >
                        <div className={styles.catalogOptionMain}>
                          <span className={styles.checkboxRow}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => onToggleCatalog(catalog.key)}
                              disabled={isDisabled}
                              className={styles.catalogCheckbox}
                            />
                          </span>
                          <div className={styles.catalogMeta}>
                            <span className={styles.catalogLabel}>{catalog.label}</span>
                            <span className={styles.catalogAccess}>
                              {getCatalogAccessLabel(canExportItem, canImportItem)}
                            </span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
