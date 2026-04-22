import React, { createContext, useContext, useState } from 'react';

interface SidebarContextType {
    isMobileMenuOpen: boolean;
    toggleMobileMenu: () => void;
    closeMobileMenu: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
    isMobileMenuOpen: false,
    toggleMobileMenu: () => {},
    closeMobileMenu: () => {}
});

export const useSidebarContext = () => useContext(SidebarContext);

interface SidebarProviderProps {
    children: React.ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps): JSX.Element {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <SidebarContext.Provider value={{ isMobileMenuOpen, toggleMobileMenu, closeMobileMenu }}>
            {children}
        </SidebarContext.Provider>
    );
}
