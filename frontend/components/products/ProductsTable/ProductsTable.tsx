import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
    FiEdit2,
    FiEye,
    FiMoreHorizontal,
    FiTrash2,
    FiTrendingUp,
} from "react-icons/fi";

import {
    EntityTableSkeleton,
    EntityTableSurface,
    entityTableClassName,
} from "@/components/EntityDataTable/EntityDataTable";
import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { Product } from "@/types/pages/products";

import styles from "../Products.module.css";

const MotionTableRow = motion(TableRow);

type ProductsTableProps = {
    canAttachmentsView: boolean
    canCreate: boolean
    canDelete: boolean
    canEdit: boolean
    canPriceHistoryView: boolean
    canView: boolean
    error: string | null
    formatCurrency: (amount: number) => string
    isLoading: boolean
    products: Product[]
    renderAttachmentBadges: (productId: number) => ReactNode
    tableKeyValue: number
    onCreateProduct: () => void
    onDeleteProduct: (product: Product) => void
    onEditProduct: (product: Product) => void
    onOpenPriceHistory: (product: Product) => void
    onOpenProduct: (productId: number) => void
    onRetry: () => void
}

export function ProductsTable({
    canAttachmentsView,
    canCreate,
    canDelete,
    canEdit,
    canPriceHistoryView,
    canView,
    error,
    formatCurrency,
    isLoading,
    products,
    renderAttachmentBadges,
    tableKeyValue,
    onCreateProduct,
    onDeleteProduct,
    onEditProduct,
    onOpenPriceHistory,
    onOpenProduct,
    onRetry,
}: ProductsTableProps) {
    if (isLoading) {
        return (
            <EntityTableSurface
                variant="embedded"
                clip="bottom"
                className={styles.tableSurface}
                key={tableKeyValue}
            >
                <EntityTableSkeleton columns={7} rows={7} actionColumn />
            </EntityTableSurface>
        );
    }

    if (error && products.length === 0) {
        return (
            <div className={styles.errorState}>
                <p className={styles.errorText}>{error}</p>
                <Button type="button" className={styles.retryButton} onClick={onRetry}>
                    Повторить попытку
                </Button>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>Товары не найдены</p>
                {canCreate ? (
                    <CreateEntityButton className={styles.createButton} onClick={onCreateProduct}>
                        Создать первый товар
                    </CreateEntityButton>
                ) : null}
            </div>
        );
    }

    return (
        <EntityTableSurface
            variant="embedded"
            clip="bottom"
            className={styles.tableSurface}
            key={tableKeyValue}
        >
            <Table className={`${entityTableClassName} ${styles.table}`}>
                <colgroup>
                    <col className={styles.colId} />
                    <col className={styles.colName} />
                    <col className={styles.colArticle} />
                    <col className={styles.colCategory} />
                    <col className={styles.colPurchase} />
                    <col className={styles.colSale} />
                    <col className={styles.colUnit} />
                    <col className={styles.colActions} />
                </colgroup>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Название</TableHead>
                        <TableHead>Артикул</TableHead>
                        <TableHead>Категория</TableHead>
                        <TableHead className={styles.textRight}>Цена закупки</TableHead>
                        <TableHead className={styles.textRight}>Цена продажи</TableHead>
                        <TableHead>Ед. изм.</TableHead>
                        <TableHead className={styles.actionsHeader} />
                    </TableRow>
                </TableHeader>

                <TableBody>
                    <AnimatePresence>
                        {products.map((product) => (
                            <MotionTableRow
                                key={product.id}
                                className={`${styles.tableRow} ${canView ? styles.tableRowClickable : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={canView ? () => onOpenProduct(product.id) : undefined}
                            >
                                <TableCell className={styles.tableCell}>
                                    <div>
                                        <div className={styles.itemId}>#{product.id}</div>
                                        {canAttachmentsView ? renderAttachmentBadges(product.id) : null}
                                    </div>
                                </TableCell>

                                <TableCell className={`${styles.tableCell} ${styles.nameCell}`}>
                                    <div className={styles.itemTitle}>{product.название}</div>
                                </TableCell>

                                <TableCell className={`${styles.tableCell} ${styles.articleCell}`}>
                                    <div className={styles.itemSub}>{product.артикул || "—"}</div>
                                </TableCell>

                                <TableCell className={`${styles.tableCell} ${styles.categoryCell}`}>
                                    <span className={styles.categoryPill}>{product.категория || "Не указана"}</span>
                                </TableCell>

                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                    <div className={styles.amountCell}>
                                        {product.цена_закупки ? formatCurrency(product.цена_закупки) : "—"}
                                    </div>
                                </TableCell>

                                <TableCell className={`${styles.tableCell} ${styles.textRight}`}>
                                    <div className={styles.amountCell}>{formatCurrency(product.цена_продажи)}</div>
                                </TableCell>

                                <TableCell className={styles.tableCell}>
                                    <div className={styles.unitCell}>{product.единица_измерения}</div>
                                </TableCell>

                                <TableCell className={styles.tableCell}>
                                    <div
                                        className={styles.actionsCell}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={(
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className={styles.menuButton}
                                                        aria-label="Действия"
                                                        title="Действия"
                                                    />
                                                )}
                                            >
                                                <FiMoreHorizontal size={18} />
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="end" sideOffset={6}>
                                                {canView ? (
                                                    <DropdownMenuItem onClick={() => onOpenProduct(product.id)}>
                                                        <FiEye className={styles.rowMenuIcon} />
                                                        Просмотр
                                                    </DropdownMenuItem>
                                                ) : null}

                                                {canEdit ? (
                                                    <DropdownMenuItem onClick={() => onEditProduct(product)}>
                                                        <FiEdit2 className={styles.rowMenuIcon} />
                                                        Редактировать
                                                    </DropdownMenuItem>
                                                ) : null}

                                                {canPriceHistoryView ? (
                                                    <DropdownMenuItem onClick={() => onOpenPriceHistory(product)}>
                                                        <FiTrendingUp className={styles.rowMenuIcon} />
                                                        История цен
                                                    </DropdownMenuItem>
                                                ) : null}

                                                {canDelete ? (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            className={styles.rowMenuItemDanger}
                                                            onClick={() => onDeleteProduct(product)}
                                                        >
                                                            <FiTrash2 className={styles.rowMenuIconDel} />
                                                            Удалить
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </MotionTableRow>
                        ))}
                    </AnimatePresence>
                </TableBody>
            </Table>
        </EntityTableSurface>
    );
}
