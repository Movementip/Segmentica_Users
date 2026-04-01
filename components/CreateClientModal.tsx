import React, { useState } from 'react';
import { ClientContragentModal } from './ClientContragentModal';
import type { ClientContragentPayload } from '../lib/clientContragents';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated: () => void;
}

export function CreateClientModal({ isOpen, onClose, onClientCreated }: CreateClientModalProps): JSX.Element {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (payload: ClientContragentPayload) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания клиента');
            }

            onClientCreated();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ClientContragentModal
            isOpen={isOpen}
            onClose={handleClose}
            onSubmit={handleSubmit}
            title="Карточка контрагента"
            submitLabel="Сохранить"
            loading={loading}
            error={error}
        />
    );
}