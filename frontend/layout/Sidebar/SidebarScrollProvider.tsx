import React, { createContext, useRef, useEffect } from 'react';
import styles from './Sidebar.module.css';
import { SidebarContent } from '../../components/ui/sidebar';

export interface SidebarScrollContextType {
    saveScrollPosition: () => void;
}

export const SidebarScrollContext = createContext<SidebarScrollContextType>({
    saveScrollPosition: () => { }
});

interface SidebarScrollProviderProps {
    children: React.ReactNode;
}

export function SidebarScrollProvider({ children }: SidebarScrollProviderProps): JSX.Element {
    const navRef = useRef<HTMLDivElement>(null);

    const saveScrollPosition = () => {
        if (navRef.current) {
            const position = navRef.current.scrollTop;
            sessionStorage.setItem('sidebarScrollPosition', position.toString());
        }
    };

    // Восстанавливаем скролл при монтировании
    useEffect(() => {
        const restoreScroll = () => {
            const savedPosition = sessionStorage.getItem('sidebarScrollPosition');
            if (navRef.current && savedPosition) {
                const position = parseInt(savedPosition, 10);
                navRef.current.scrollTop = position;
            }
        };

        // Восстанавливаем скролл после небольшой задержки
        const timeoutId = setTimeout(restoreScroll, 200);

        return () => clearTimeout(timeoutId);
    }, []); // Пустой массив зависимостей - выполняется только при монтировании

    return (
        <SidebarScrollContext.Provider value={{ saveScrollPosition }}>
            <SidebarContent ref={navRef} className={styles.nav}>
                {children}
            </SidebarContent>
        </SidebarScrollContext.Provider>
    );
}
