import React, { useEffect, useState } from 'react';
import { SupplierContragentModal } from '../SupplierContragentModal/SupplierContragentModal';
import type { SupplierContragentPayload } from '../../../lib/supplierContragents';

interface CreateSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSupplierCreated: () => void;
}

export function CreateSupplierModal({ isOpen, onClose, onSupplierCreated }: CreateSupplierModalProps): JSX.Element | null {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
    }, [isOpen]);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (payload: SupplierContragentPayload) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/suppliers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(responseData.error || 'Ошибка создания поставщика');
            }

            onSupplierCreated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка при создании поставщика');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SupplierContragentModal
            key={isOpen ? 'supplier-create-open' : 'supplier-create-closed'}
            isOpen={isOpen}
            onClose={handleClose}
            onSubmit={handleSubmit}
            title="Создать поставщика"
            submitLabel="Создать"
            loading={loading}
            error={error}
        />
    );
}
