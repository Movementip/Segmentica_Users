import React from 'react';
import Link from 'next/link';
import { withLayout } from '../../layout';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import styles from './AdminRbac.module.css';
import { UsersAdmin } from '../../components/AdminRbac/UsersAdmin';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

function AdminHome(): JSX.Element {
    const { user, loading } = useAuth();
    const canViewDocuments = Boolean(user?.permissions?.includes('documents.view'));

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Администрирование</h1>
                        <div className={styles.subtitle}>RBAC (доступ: director)</div>
                    </div>
                    <Flex gap="3" wrap="wrap">
                        {canViewDocuments ? (
                            <Button asChild variant="surface" color="gray" highContrast>
                                <Link href="/documents">Документы</Link>
                            </Button>
                        ) : null}
                        <Button asChild variant="surface" color="gray" highContrast>
                            <Link href="/admin/schedule-board">График сотрудников</Link>
                        </Button>
                        <Button asChild variant="surface" color="gray" highContrast>
                            <Link href="/admin/settings">Настройки системы</Link>
                        </Button>
                        <Button asChild variant="surface" color="gray" highContrast>
                            <Link href="/admin/data-exchange">Обмен данными</Link>
                        </Button>
                    </Flex>
                </div>
            </div>

            <Box mt="4">
                <UsersAdmin embedded />
            </Box>
        </div>
    );
}

export default withLayout(AdminHome);
