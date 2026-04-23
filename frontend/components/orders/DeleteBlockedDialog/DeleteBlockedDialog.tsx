import type { LinkedPurchase } from "@/types/pages/orders"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import styles from "./DeleteBlockedDialog.module.css"

type DeleteBlockedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchases: LinkedPurchase[]
  movementsCount: number
  onOpenPurchase: (purchaseId: number) => void
  onOpenPurchasesList: () => void
}

export function DeleteBlockedDialog({
  open,
  onOpenChange,
  purchases,
  movementsCount,
  onOpenPurchase,
  onOpenPurchasesList,
}: DeleteBlockedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.modalContent}>
        <DialogHeader>
          <DialogTitle>Невозможно удалить заявку</DialogTitle>
          <DialogDescription>
            У заявки есть связанные закупки ({purchases.length})
            {movementsCount ? ` и движения склада (${movementsCount})` : ""}.
            Сначала удалите или обработайте их.
          </DialogDescription>
        </DialogHeader>

        {purchases.length ? (
          <div className={styles.positionsSection}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionTitle}>Связанные закупки</div>
            </div>
            <div className={styles.purchaseChips}>
              {purchases.map((purchase) => (
                <Button
                  key={purchase.id}
                  type="button"
                  variant="outline"
                  className={styles.purchaseChipButton}
                  onClick={() => onOpenPurchase(purchase.id)}
                >
                  Закупка #{purchase.id}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <Button
            type="button"
            variant="outline"
            className={styles.surfaceButton}
            onClick={() => onOpenChange(false)}
          >
            Закрыть
          </Button>
          <Button type="button" onClick={onOpenPurchasesList}>
            Перейти к закупкам
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
