import React, { useState } from 'react';
import { ClientContragentModal } from '../ClientContragentModal/ClientContragentModal';
import type { ClientContragent, ClientContragentPayload } from '../../../lib/clientContragents';

type Client = ClientContragent;

interface EditClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (clientData: ClientContragentPayload & { id: number }) => Promise<void> | void;
    client: Client | null;
}

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, onSubmit, client }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleSubmit = async (payload: ClientContragentPayload) => {
        if (!client) return;

        setLoading(true);
        try {
            await onSubmit({
                id: client.id,
                ...payload,
            });
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка обновления клиента');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !client) return null;

    return (
        <ClientContragentModal
            isOpen={isOpen}
            onClose={handleClose}
            onSubmit={handleSubmit}
            title={`Карточка контрагента #${client.id}`}
            submitLabel="Сохранить"
            loading={loading}
            error={error}
            value={client}
        />
    );
};

export default EditClientModal;
