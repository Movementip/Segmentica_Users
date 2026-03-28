import React, { createContext, useContext, useState } from 'react';

interface PageTitleContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
    pageTitle: 'Дашборд',
    setPageTitle: () => {}
});

export const usePageTitle = () => useContext(PageTitleContext);

interface PageTitleProviderProps {
    children: React.ReactNode;
}

export function PageTitleProvider({ children }: PageTitleProviderProps): JSX.Element {
    const [pageTitle, setPageTitle] = useState('Дашборд');

    return (
        <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
            {children}
        </PageTitleContext.Provider>
    );
}
