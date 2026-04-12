import React from 'react';
import { withLayout } from '../../layout';
import { UsersAdmin } from '../../components/AdminRbac/UsersAdmin';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

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
