import React, { createContext, useState } from 'react';

export interface SidebarContextType {
    isMobileMenuOpen: boolean;
    toggleMobileMenu: () => void;
    closeMobileMenu: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
    isMobileMenuOpen: false,
    toggleMobileMenu: () => {},
    closeMobileMenu: () => {}
});

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
