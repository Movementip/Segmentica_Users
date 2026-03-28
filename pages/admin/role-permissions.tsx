import React from 'react';
import { withLayout } from '../../layout';
import { RolePermissionsAdmin } from '../../components/AdminRbac/RolePermissionsAdmin';

function RolePermissionsAdminPage(): JSX.Element {
    return <RolePermissionsAdmin />;
}

export default withLayout(RolePermissionsAdminPage);
