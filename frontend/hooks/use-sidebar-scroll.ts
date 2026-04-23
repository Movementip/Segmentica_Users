import { useContext } from 'react';

import { SidebarScrollContext } from '../layout/Sidebar/SidebarScrollProvider';

export const useSidebarScroll = () => useContext(SidebarScrollContext);
