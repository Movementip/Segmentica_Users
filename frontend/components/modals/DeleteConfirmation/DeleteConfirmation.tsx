import React from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import styles from "./DeleteConfirmation.module.css"

interface Order {
    id: number
    клиент_название?: string
    общая_сумма?: number
}

interface DeleteConfirmationProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    order?: Order | null
    loading?: boolean
    title?: string
    message?: string
    warning?: string
    confirmText?: string
    cancelText?: string
    details?: React.ReactNode
    contentClassName?: string
    actionsClassName?: string
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
    isOpen,
    onClose,
    onConfirm,
    order = null,
    loading = false,
    title,
    message,
    warning,
    confirmText,
    cancelText,
    details,
    contentClassName,
    actionsClassName,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <DialogContent className={cn(styles.modalContent, contentClassName)}>
                <DialogHeader className={styles.header}>
                    <div className={styles.iconBox} aria-hidden="true">
                        <AlertTriangle />
                    </div>
                    <div className={styles.headerText}>
                        <DialogTitle>{title || "Подтверждение удаления"}</DialogTitle>
                        <DialogDescription>
                            {message || "Вы уверены, что хотите удалить заявку?"}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className={styles.body}>
                    {details ? details : order ? <CardInfo order={order} /> : null}

                    <div className={styles.warning}>
                        <span className={styles.warningLabel}>Внимание:</span>{" "}
                        {warning ||
                            "Это действие нельзя отменить. Все данные заявки и связанные позиции будут удалены."}
                    </div>
                </div>

                <div className={cn(styles.modalActions, actionsClassName)}>
                    <Button
                        type="button"
                        variant="outline"
                        className={styles.cancelButton}
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText || "Отмена"}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        className={styles.modalDeleteButton}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? "Удаление..." : confirmText || "Удалить"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const CardInfo = ({ order }: { order: Order }) => {
    const sum = typeof order.общая_сумма === "number"
        ? order.общая_сумма.toLocaleString("ru-RU", {
            style: "currency",
            currency: "RUB",
        })
        : null

    return (
        <div className={styles.positionsSection}>
            <div className={styles.orderTitle}>Заявка #{order.id}</div>
            {order.клиент_название ? (
                <div className={styles.orderMeta}>Клиент: {order.клиент_название}</div>
            ) : null}
            {sum ? <div className={styles.orderMeta}>Сумма: {sum}</div> : null}
        </div>
    )
}

export default DeleteConfirmation
