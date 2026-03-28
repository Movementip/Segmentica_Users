import React from 'react';
import { Badge, Box, Button, Dialog, Flex, Text } from '@radix-ui/themes';
import styles from './OrderWorkflowModal.module.css';

export interface OrderWorkflowModalSummary {
    orderId: number;
    currentStatus: string;
    derivedStatus: string;
    positionCount: number;
    activeMissingCount: number;
    missingUnits: number;
    missingOrderedCount: number;
    missingProcessingCount: number;
    purchaseCount: number;
    activePurchaseCount: number;
    shipmentCount: number;
    activeShipmentCount: number;
    deliveredShipmentCount: number;
    assemblyBatchCount: number;
    isAssembled: boolean;
    readyForAssembly: boolean;
    canAssemble: boolean;
    readyForShipment: boolean;
    canCreateShipment: boolean;
    canCreatePurchase: boolean;
    canComplete: boolean;
    hasAssemblyHistory: boolean;
    hasShipmentHistory: boolean;
    coveredFromStockUnits: number;
    warehouseTakenUnits: number;
    assembledUnits: number;
    shippedUnits: number;
    deliveredUnits: number;
    remainingAssemblyUnits: number;
    remainingShipmentUnits: number;
    nextAssemblyActionLabel: string | null;
    nextShipmentActionLabel: string | null;
    positions: Array<{
        товар_id: number;
        товар_название: string;
        товар_артикул?: string;
        необходимое_количество: number;
        склад_количество: number;
        активная_недостача: number;
        покрыто_со_склада: number;
        собранное_количество: number;
        отгруженное_количество: number;
        доставленное_количество: number;
        осталось_собрать: number;
        осталось_отгрузить: number;
    }>;
    missingProducts: Array<{
        id: number;
        товар_id: number;
        необходимое_количество: number;
        недостающее_количество: number;
        статус: string;
    }>;
    purchases: Array<{ id: number; статус: string; дата_заказа?: string; общая_сумма?: number }>;
    shipments: Array<{ id: number; branchNo: number; shipmentKind: string; статус: string; дата_отгрузки?: string; транспорт_название?: string; номер_отслеживания?: string; totalUnits: number }>;
    assemblyBatches: Array<{
        id: number;
        branchNo: number;
        batchType: string;
        createdAt?: string;
        totalUnits: number;
        positions: Array<{ товар_id: number; товар_название: string; quantity: number }>;
    }>;
}

interface OrderWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: OrderWorkflowModalSummary | null;
    loading?: boolean;
    error?: string | null;
    onOpenOrder?: () => void;
    onAssemble?: () => void;
    onCreateShipment?: () => void;
}

const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
        case 'выполнена':
        case 'отгружена':
            return 'green';
        case 'собрана':
            return 'violet';
        case 'досборка':
            return 'orange';
        case 'доотгрузка':
            return 'cyan';
        case 'в работе':
        case 'в обработке':
            return 'amber';
        case 'отменена':
            return 'red';
        default:
            return 'blue';
    }
};

const formatDate = (value?: string) => {
    if (!value) return 'Дата не указана';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('ru-RU');
};

const formatMoney = (value?: number) => {
    if (value == null || Number.isNaN(value)) return 'Сумма не указана';
    return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
};

export function OrderWorkflowModal({
    isOpen,
    onClose,
    summary,
    loading,
    error,
    onOpenOrder,
    onAssemble,
    onCreateShipment,
}: OrderWorkflowModalProps): JSX.Element | null {
    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <Dialog.Content className={styles.modalContent}>
                <Dialog.Title>Цепочка заявки</Dialog.Title>

                {loading ? (
                    <Text as="div" size="2" color="gray">Загрузка сводки...</Text>
                ) : error ? (
                    <Text as="div" size="2" color="red">{error}</Text>
                ) : summary ? (
                    <>
                        <div className={styles.header}>
                            <Text as="div" size="5" weight="bold">
                                Заявка #{summary.orderId}
                            </Text>
                            <Flex gap="3" wrap="wrap" align="center">
                                <Badge variant="soft" color={getStatusColor(summary.currentStatus)} highContrast className={styles.statusPill}>
                                    Статус заявки: {summary.currentStatus}
                                </Badge>
                            </Flex>
                        </div>

                        <div className={styles.grid}>
                            <div className={styles.card}>
                                <Text as="div" size="3" weight="bold" className={styles.cardTitle}>
                                    Обеспечение товаром
                                </Text>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Активные недостачи</Text>
                                    <Text size="2" weight="bold">{summary.activeMissingCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Не хватает единиц</Text>
                                    <Text size="2" weight="bold">{summary.missingUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">В работе</Text>
                                    <Text size="2" weight="bold">{summary.missingProcessingCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Уже заказано</Text>
                                    <Text size="2" weight="bold">{summary.missingOrderedCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Покрыто со склада</Text>
                                    <Text size="2" weight="bold">{summary.coveredFromStockUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Собрано</Text>
                                    <Text size="2" weight="bold">{summary.assembledUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Фактически списано со склада</Text>
                                    <Text size="2" weight="bold">{summary.warehouseTakenUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Осталось собрать</Text>
                                    <Text size="2" weight="bold">{summary.remainingAssemblyUnits}</Text>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <Text as="div" size="3" weight="bold" className={styles.cardTitle}>
                                    Закупки и отгрузки
                                </Text>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Закупок создано</Text>
                                    <Text size="2" weight="bold">{summary.purchaseCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Активных закупок</Text>
                                    <Text size="2" weight="bold">{summary.activePurchaseCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Отгрузок создано</Text>
                                    <Text size="2" weight="bold">{summary.shipmentCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Активных отгрузок</Text>
                                    <Text size="2" weight="bold">{summary.activeShipmentCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Доставленных отгрузок</Text>
                                    <Text size="2" weight="bold">{summary.deliveredShipmentCount}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Отгружено единиц</Text>
                                    <Text size="2" weight="bold">{summary.shippedUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Доставлено единиц</Text>
                                    <Text size="2" weight="bold">{summary.deliveredUnits}</Text>
                                </div>
                                <div className={styles.cardLine}>
                                    <Text size="2" color="gray">Осталось отгрузить</Text>
                                    <Text size="2" weight="bold">{summary.remainingShipmentUnits}</Text>
                                </div>
                            </div>
                        </div>

                        <div className={styles.timeline}>
                            <Text as="div" size="3" weight="bold" mb="3">
                                Последовательность заявки
                            </Text>
                            <div className={styles.timelineList}>
                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${styles.timelineDotDone}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>1. Заявка создана</div>
                                        <div className={styles.timelineText}>Документ зарегистрирован и запущен в обработку.</div>
                                        <div className={styles.detailList}>
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>Текущий статус</span>
                                                <span className={styles.detailValue}>{summary.currentStatus}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>Позиции в заявке</span>
                                                <span className={styles.detailValue}>{summary.positionCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${summary.activeMissingCount > 0 ? styles.timelineDotWarn : styles.timelineDotDone}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>2. Проверка склада и недостач</div>
                                        <div className={styles.timelineText}>
                                            {summary.activeMissingCount > 0
                                                ? `Есть активные недостачи: ${summary.activeMissingCount} поз., не хватает ${summary.missingUnits} ед.`
                                                : `Все позиции закрыты. Со склада покрыто ${summary.coveredFromStockUnits} ед.`}
                                        </div>
                                        <div className={styles.detailList}>
                                            {summary.positions.map((position) => (
                                                <div key={position.товар_id} className={styles.detailCard}>
                                                    <div className={styles.detailCardTitle}>
                                                        {position.товар_название}
                                                        {position.товар_артикул ? ` (${position.товар_артикул})` : ''}
                                                    </div>
                                                    <div className={styles.detailCardMeta}>
                                                        Нужно: {position.необходимое_количество} | Собрано: {position.собранное_количество} | Отгружено: {position.отгруженное_количество} | Доставлено: {position.доставленное_количество} | Активная недостача: {position.активная_недостача}
                                                    </div>
                                                </div>
                                            ))}
                                            {summary.missingProducts.length > 0 ? (
                                                <div className={styles.sectionNote}>
                                                    История недостач: {summary.missingProducts.map((item) => `#${item.id} (${item.статус})`).join(', ')}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${summary.activePurchaseCount > 0 ? styles.timelineDotActive : summary.purchaseCount > 0 ? styles.timelineDotDone : ''}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>3. Закупка</div>
                                        <div className={styles.timelineText}>
                                            {summary.purchaseCount > 0
                                                ? summary.purchases.map((purchase) => `#${purchase.id} (${purchase.статус})`).join(', ')
                                                : 'Связанной закупки пока нет.'}
                                        </div>
                                        {summary.purchaseCount > 0 ? (
                                            <div className={styles.detailList}>
                                                {summary.purchases.map((purchase) => (
                                                    <div key={purchase.id} className={styles.detailCard}>
                                                        <div className={styles.detailCardTitle}>Закупка #{purchase.id}</div>
                                                        <div className={styles.detailCardMeta}>
                                                            Статус: {purchase.статус} | {formatDate(purchase.дата_заказа)} | {formatMoney(purchase.общая_сумма)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${summary.canAssemble ? styles.timelineDotActive : summary.isAssembled ? styles.timelineDotDone : ''}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>4. Сборка заявки</div>
                                        <div className={styles.timelineText}>
                                            {summary.isAssembled
                                                ? 'Все требуемые позиции уже собраны и списаны со склада.'
                                                : summary.canAssemble
                                                    ? 'Следующий шаг: выполнить сборку или досборку по оставшимся позициям.'
                                                    : 'Сборка станет доступна, когда будут закрыты недостачи и завершены закупки.'}
                                        </div>
                                        {summary.assemblyBatches.length > 0 ? (
                                            <div className={styles.detailList}>
                                                {summary.assemblyBatches.map((batch) => (
                                                    <div key={batch.id} className={styles.detailCard}>
                                                        <div className={styles.detailCardTitle}>
                                                            {batch.batchType === 'досборка' ? 'Досборка' : 'Сборка'} #{batch.branchNo}
                                                        </div>
                                                        <div className={styles.detailCardMeta}>
                                                            {formatDate(batch.createdAt)} | Единиц: {batch.totalUnits}
                                                        </div>
                                                        {batch.positions.length > 0 ? (
                                                            <div className={styles.sectionNote}>
                                                                {batch.positions.map((position) => `${position.товар_название} x ${position.quantity}`).join(', ')}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${summary.activeShipmentCount > 0 ? styles.timelineDotActive : summary.deliveredShipmentCount > 0 ? styles.timelineDotDone : summary.canCreateShipment ? styles.timelineDotDone : ''}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>5. Отгрузка</div>
                                        <div className={styles.timelineText}>
                                            {summary.shipmentCount > 0
                                                ? summary.shipments.map((shipment) => `#${shipment.id} (${shipment.shipmentKind}, ${shipment.статус}${shipment.транспорт_название ? `, ${shipment.транспорт_название}` : ''})`).join(', ')
                                                : summary.canCreateShipment
                                                    ? 'Есть собранные позиции, которые еще не уехали. Следующий шаг: создать ветвь отгрузки.'
                                                    : 'Отгрузка станет доступна после сборки заявки.'}
                                        </div>
                                        {summary.shipmentCount > 0 ? (
                                            <div className={styles.detailList}>
                                                {summary.shipments.map((shipment) => (
                                                    <div key={shipment.id} className={styles.detailCard}>
                                                        <div className={styles.detailCardTitle}>
                                                            {shipment.shipmentKind === 'доотгрузка' ? 'Доотгрузка' : 'Отгрузка'} #{shipment.branchNo}
                                                        </div>
                                                        <div className={styles.detailCardMeta}>
                                                            ID: #{shipment.id} | Статус: {shipment.статус}
                                                            {shipment.транспорт_название ? ` | ${shipment.транспорт_название}` : ''}
                                                            {shipment.номер_отслеживания ? ` | Трек: ${shipment.номер_отслеживания}` : ''}
                                                            {shipment.totalUnits ? ` | Единиц: ${shipment.totalUnits}` : ''}
                                                            {shipment.дата_отгрузки ? ` | ${formatDate(shipment.дата_отгрузки)}` : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${summary.canComplete ? styles.timelineDotDone : ''}`} />
                                    <div>
                                        <div className={styles.timelineTitle}>6. Завершение</div>
                                        <div className={styles.timelineText}>
                                            {summary.canComplete
                                                ? 'Цепочка закрыта: заявку уже можно переводить в статус «Выполнена».'
                                                : summary.remainingShipmentUnits > 0
                                                    ? 'Завершение станет доступно после полной отгрузки и доставки всех оставшихся позиций.'
                                                    : 'Завершение станет доступно после доставленной отгрузки.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            {onOpenOrder ? (
                                <Button type="button" variant="surface" color="gray" highContrast onClick={onOpenOrder} className={styles.actionButton}>
                                    Перейти к заявке
                                </Button>
                            ) : null}
                            {summary.canAssemble && onAssemble ? (
                                <Button type="button" variant="solid" color="gray" highContrast onClick={onAssemble} className={styles.actionPrimary}>
                                    {summary.nextAssemblyActionLabel || 'Собрать заявку'}
                                </Button>
                            ) : null}
                            {summary.canCreateShipment && onCreateShipment ? (
                                <Button type="button" variant="solid" color="gray" highContrast onClick={onCreateShipment} className={styles.actionPrimary}>
                                    {summary.nextShipmentActionLabel || 'Создать отгрузку'}
                                </Button>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <Text as="div" size="2" color="gray">Нет данных по workflow заявки.</Text>
                )}
            </Dialog.Content>
        </Dialog.Root>
    );
}
