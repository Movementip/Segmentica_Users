import React from 'react';
import { withLayout } from '../../layout';
import { RolePermissionsAdmin } from '../../components/admin/rbac/RolePermissionsAdmin/RolePermissionsAdmin';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';

function RolePermissionsAdminPage(): JSX.Element {
    const { user, loading } = useAuth();

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <RolePermissionsAdmin />;
}

export default withLayout(RolePermissionsAdminPage);
