import React from 'react';
import { withLayout } from '../../layout';
import { RolesAdmin } from '../../components/AdminRbac/RolesAdmin';

function RolesAdminPage(): JSX.Element {
    return <RolesAdmin />;
}

export default withLayout(RolesAdminPage);
