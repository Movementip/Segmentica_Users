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
    initialTitle?: string;
}

export function PageTitleProvider({ children, initialTitle = 'Дашборд' }: PageTitleProviderProps): JSX.Element {
    const [pageTitle, setPageTitle] = useState(initialTitle);

    return (
        <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
            {children}
        </PageTitleContext.Provider>
    );
}
