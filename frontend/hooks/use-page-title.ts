import { useContext } from 'react';

import { PageTitleContext } from '../context/PageTitleContext';

export const usePageTitle = () => useContext(PageTitleContext);
