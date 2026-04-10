import React from 'react';
import { withLayout } from '../../layout';
import { PermissionsAdmin } from '../../components/AdminRbac/PermissionsAdmin';
import { useAuth } from '../../context/AuthContext';
import { Box, Text } from '@radix-ui/themes';
import { NoAccessPage } from '../../components/NoAccessPage';

function PermissionsAdminPage(): JSX.Element {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <PermissionsAdmin />;
}

export default withLayout(PermissionsAdminPage);
