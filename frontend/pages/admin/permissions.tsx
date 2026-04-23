import React from 'react';
import { withLayout } from '../../layout';
import { PermissionsAdmin } from '../../components/admin/rbac/PermissionsAdmin/PermissionsAdmin';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';

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
