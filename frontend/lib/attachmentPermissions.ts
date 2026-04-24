import type { AuthUser } from '../types/auth';

const hasPermission = (user: AuthUser | null | undefined, permissionKey: string): boolean => {
    if (!user) return false;
    if (!Array.isArray(user.permissions)) return false;
    return user.permissions.some((permission) => String(permission) === permissionKey);
};

export type AttachmentEntityType =
    | 'order'
    | 'product'
    | 'client'
    | 'purchase'
    | 'shipment'
    | 'supplier'
    | 'transport'
    | 'manager';

export type AttachmentAction = 'view' | 'upload' | 'delete';

export type AttachmentPermScope = {
    scope?: string | null;
};

export type AttachmentLinkAccessRow = {
    entity_type: string;
};

export const DOCUMENT_PERMISSIONS = {
    view: 'documents.view',
    upload: 'documents.upload',
    attach: 'documents.attach',
    delete: 'documents.delete',
} as const;

export const ATTACHMENT_ENTITY_LABELS: Record<AttachmentEntityType, string> = {
    order: 'Заявка',
    product: 'Товар',
    client: 'Контрагент',
    purchase: 'Закупка',
    shipment: 'Отгрузка',
    supplier: 'Поставщик',
    transport: 'ТК',
    manager: 'Сотрудник',
};

export const ATTACHMENT_ENTITY_OPTIONS: Array<{ value: AttachmentEntityType; label: string }> = [
    { value: 'order', label: 'Заявка' },
    { value: 'client', label: 'Контрагент' },
    { value: 'purchase', label: 'Закупка' },
    { value: 'shipment', label: 'Отгрузка' },
    { value: 'supplier', label: 'Поставщик' },
    { value: 'transport', label: 'Транспортная компания' },
    { value: 'manager', label: 'Сотрудник' },
    { value: 'product', label: 'Товар' },
];

export const getAttachmentEntityHref = (entityType: AttachmentEntityType, entityId: number) => {
    switch (entityType) {
        case 'order':
            return `/orders/${entityId}`;
        case 'client':
            return `/clients/${entityId}`;
        case 'purchase':
            return `/purchases/${entityId}`;
        case 'shipment':
            return `/shipments/${entityId}`;
        case 'supplier':
            return `/suppliers/${entityId}`;
        case 'transport':
            return `/transport/${entityId}`;
        case 'manager':
            return `/managers/${entityId}`;
        case 'product':
            return `/products/${entityId}`;
        default:
            return null;
    }
};

export const normalizeAttachmentEntityType = (value: unknown): AttachmentEntityType | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (
        normalized === 'order'
        || normalized === 'product'
        || normalized === 'client'
        || normalized === 'purchase'
        || normalized === 'shipment'
        || normalized === 'supplier'
        || normalized === 'transport'
        || normalized === 'manager'
    ) {
        return normalized;
    }

    return null;
};

export const getAttachmentPermissionKey = (
    entityType: string,
    action: AttachmentAction,
    opts?: AttachmentPermScope
) => {
    const t = normalizeAttachmentEntityType(entityType);
    const scope = String(opts?.scope || '').trim().toLowerCase();

    if (t === 'product' && scope === 'warehouse') {
        return `warehouse-products.attachments.${action}`;
    }

    const prefix =
        t === 'order'
            ? 'orders'
            : t === 'product'
                ? 'products'
                : t === 'client'
                    ? 'clients'
                    : t === 'purchase'
                        ? 'purchases'
                        : t === 'shipment'
                            ? 'shipments'
                            : t === 'supplier'
                                ? 'suppliers'
                                : t === 'transport'
                                    ? 'transport'
                                    : t === 'manager'
                                        ? 'managers'
                                        : null;

    if (!prefix) return null;
    return `${prefix}.attachments.${action}`;
};

export const canAccessAttachmentByLinks = (
    user: AuthUser | null | undefined,
    links: AttachmentLinkAccessRow[],
    opts?: AttachmentPermScope
) => {
    if (!user) return false;

    if (hasPermission(user, DOCUMENT_PERMISSIONS.view)) {
        return true;
    }

    return links.some((link) => {
        const perm = getAttachmentPermissionKey(link.entity_type, 'view', opts);
        return perm ? hasPermission(user, perm) : false;
    });
};
