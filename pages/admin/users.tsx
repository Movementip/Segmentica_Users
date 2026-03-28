import React from 'react';
import { withLayout } from '../../layout';
import { UsersAdmin } from '../../components/AdminRbac/UsersAdmin';

function UsersAdminPage(): JSX.Element {
    return <UsersAdmin />;
}

export default withLayout(UsersAdminPage);
