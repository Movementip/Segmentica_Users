import React from 'react';
import { withLayout } from '../../layout';
import { RolesAdmin } from '../../components/admin/rbac/RolesAdmin/RolesAdmin';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';

function RolesAdminPage(): JSX.Element {
    const { user, loading } = useAuth();

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <RolesAdmin />;
}

export default withLayout(RolesAdminPage);
