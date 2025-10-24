import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../layout/Layout';
import { CreateClientModal } from '../components/CreateClientModal';
import styles from '../styles/Clients.module.css';
import { FiPlus, FiRefreshCw, FiTrash2, FiSearch, FiEdit2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface Client {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
    created_at?: string;
}

function ClientsPage(): JSX.Element {
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [operationLoading, setOperationLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchClients();
        }, searchQuery ? 300 : 0);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/clients');

            if (!response.ok) {
                throw new Error('Ошибка загрузки клиентов');
            }

            let data = await response.json();

            // Apply search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                data = data.filter((client: Client) =>
                    (client.название?.toLowerCase().includes(query)) ||
                    (client.телефон?.toLowerCase().includes(query)) ||
                    (client.email?.toLowerCase().includes(query)) ||
                    (client.адрес?.toLowerCase().includes(query)) ||
                    (client.id.toString().includes(query))
                );
            }

            setClients(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClient = () => {
        setIsCreateModalOpen(true);
    };

    const handleDeleteClient = (client: Client, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setSelectedClient(client);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedClient) return;

        try {
            setOperationLoading(true);
            const response = await fetch(`/api/clients?id=${selectedClient.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления клиента');
            }

            await fetchClients();
            setIsDeleteModalOpen(false);
            setSelectedClient(null);
        } catch (error) {
            console.error('Error deleting client:', error);
            setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleClientCreated = () => {
        fetchClients();
        setIsCreateModalOpen(false);
    };

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    Ошибка: {error}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Контрагенты</h1>
                <div className={styles.actions}>
                    <div className={styles.searchContainer}>
                        <FiSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Поиск клиентов..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        className={`${styles.button} ${styles.secondary}`}
                        onClick={fetchClients}
                        disabled={operationLoading}
                    >
                        <FiRefreshCw className={operationLoading ? styles.spin : ''} />
                        Обновить
                    </button>
                    <button
                        className={styles.button}
                        onClick={handleCreateClient}
                    >
                        <FiPlus />
                        Добавить клиента
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={styles.loading}>Загрузка клиентов...</div>
            ) : clients.length === 0 ? (
                <div className={styles.noResults}>
                    {searchQuery ? 'Клиенты не найдены' : 'Клиенты не найдены. Добавьте клиентов в базу данных.'}
                </div>
            ) : (
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.tr}>
                                <th className={styles.th}>ID</th>
                                <th className={styles.th}>Название</th>
                                <th className={styles.th}>Телефон</th>
                                <th className={styles.th}>Email</th>
                                <th className={styles.th}>Адрес</th>
                                <th className={styles.th} style={{ textAlign: 'right' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((client) => (
                                <tr
                                    key={client.id}
                                    className={styles.tr}
                                    onClick={() => router.push(`/clients/${client.id}`)}
                                >
                                    <td className={styles.td}>{client.id}</td>
                                    <td className={styles.td} style={{ fontWeight: 500 }}>{client.название}</td>
                                    <td className={styles.td}>{client.телефон || '-'}</td>
                                    <td className={styles.td}>{client.email || '-'}</td>
                                    <td className={styles.td}>{client.адрес || '-'}</td>
                                    <td className={styles.td} style={{ textAlign: 'right' }}>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.actionButton}
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                                    e.stopPropagation();
                                                    router.push(`/clients/${client.id}/edit`);
                                                }}
                                                type="button"
                                            >

                                            </button>
                                            <button
                                                className={`${styles.actionButton} ${styles.delete}`}
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDeleteClient(client, e)}
                                                type="button"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateClientModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onClientCreated={handleClientCreated}
            />

            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCreateModalOpen(false)}
                    >
                        <motion.div
                            className={styles.modalContent}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <CreateClientModal
                                isOpen={isCreateModalOpen}
                                onClose={() => setIsCreateModalOpen(false)}
                                onClientCreated={handleClientCreated}
                            />
                        </motion.div>
                    </motion.div>
                )}

                {isDeleteModalOpen && selectedClient && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            setIsDeleteModalOpen(false);
                            setSelectedClient(null);
                        }}
                    >
                        <motion.div
                            className={styles.modalContent}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '400px' }}
                        >
                            <div className={styles.modalHeader}>
                                <h3 className={styles.modalTitle}>Подтверждение удаления</h3>
                                <button
                                    className={styles.modalClose}
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setSelectedClient(null);
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                            <p>Вы уверены, что хотите удалить клиента <strong>"{selectedClient.название}"</strong>?</p>
                            <div className={styles.modalActions}>
                                <button
                                    className={`${styles.modalButton} ${styles.secondary}`}
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setSelectedClient(null);
                                    }}
                                    disabled={operationLoading}
                                >
                                    Отмена
                                </button>
                                <button
                                    className={`${styles.modalButton} ${styles.primary}`}
                                    onClick={handleConfirmDelete}
                                    disabled={operationLoading}
                                    style={{ backgroundColor: '#ef4444' }}
                                >
                                    {operationLoading ? 'Удаление...' : 'Удалить'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default withLayout(ClientsPage);