export const getPurchaseDeliveryLabel = (useDelivery?: boolean | null): string => (
    useDelivery ? 'Доставка поставщиком/ТК' : 'Забрали сами'
);

export const getShipmentDeliveryLabel = (useDelivery?: boolean | null): string => (
    useDelivery ? 'Доставка' : 'Передача без доставки'
);
