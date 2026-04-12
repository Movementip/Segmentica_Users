import React from 'react';
import { withLayout } from '../../layout';
import { PermissionsAdmin } from '../../components/AdminRbac/PermissionsAdmin';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

function PermissionsAdminPage(): JSX.Element {
    const { user, loading } = useAuth();

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <PermissionsAdmin />;
}

export default withLayout(PermissionsAdminPage);
