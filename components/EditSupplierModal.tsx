import React, { useEffect, useState } from 'react';
import { SupplierContragentModal } from './SupplierContragentModal';
import type { SupplierContragent, SupplierContragentPayload } from '../lib/supplierContragents';

export type EditSupplierModalSupplier = SupplierContragent;

interface EditSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void | Promise<void>;
    supplier: EditSupplierModalSupplier | null;
}

export function EditSupplierModal({ isOpen, onClose, onUpdated, supplier }: EditSupplierModalProps): JSX.Element {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setError(null);
        setLoading(false);
    }, [isOpen, supplier]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (payload: SupplierContragentPayload) => {
        if (!supplier) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/suppliers/${supplier.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка обновления поставщика');
            }

            onUpdated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при обновлении поставщика');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return <></>;

    return (
        <SupplierContragentModal
            isOpen={isOpen}
            onClose={handleClose}
            onSubmit={handleSubmit}
            title={`Карточка поставщика #${supplier?.id}`}
            submitLabel="Сохранить"
            loading={loading}
            error={error}
            value={supplier}
        />
    );
}
