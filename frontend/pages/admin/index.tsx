import React from 'react';
import { withLayout } from '../../layout';
import { AdminOverview } from '../../components/admin/rbac/AdminOverview/AdminOverview';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';

function AdminHome(): JSX.Element {
    const { user, loading } = useAuth();
    const canViewDocuments = Boolean(user?.permissions?.includes('documents.view'));

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <AdminOverview canViewDocuments={canViewDocuments} />;
}

export default withLayout(AdminHome);
