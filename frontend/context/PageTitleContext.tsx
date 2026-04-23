import React, { createContext, useState } from 'react';

export interface PageTitleContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
}

export const PageTitleContext = createContext<PageTitleContextType>({
    pageTitle: 'Дашборд',
    setPageTitle: () => { }
});

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
