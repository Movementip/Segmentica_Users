import React from 'react';
import { withLayout } from '../../layout';
import { PermissionsAdmin } from '../../components/AdminRbac/PermissionsAdmin';

function PermissionsAdminPage(): JSX.Element {
    return <PermissionsAdmin />;
}

export default withLayout(PermissionsAdminPage);
