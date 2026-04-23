import React from 'react';
import { withLayout } from '../../layout';
import { UsersAdmin } from '../../components/admin/rbac/UsersAdmin/UsersAdmin';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';

function UsersAdminPage(): JSX.Element {
    const { user, loading } = useAuth();

    if (loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!user?.roles?.includes('director')) {
        return <NoAccessPage />;
    }

    return <UsersAdmin />;
}

export default withLayout(UsersAdminPage);
