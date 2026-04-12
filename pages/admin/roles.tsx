import React from 'react';
import { withLayout } from '../../layout';
import { RolesAdmin } from '../../components/AdminRbac/RolesAdmin';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

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
