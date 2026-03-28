import React, { createContext, useContext, useRef, useEffect } from 'react';
import styles from './Sidebar.module.css';

interface SidebarScrollContextType {
    saveScrollPosition: () => void;
}

const SidebarScrollContext = createContext<SidebarScrollContextType>({
    saveScrollPosition: () => { }
});

export const useSidebarScroll = () => useContext(SidebarScrollContext);

interface SidebarScrollProviderProps {
    children: React.ReactNode;
}

export function SidebarScrollProvider({ children }: SidebarScrollProviderProps): JSX.Element {
    const navRef = useRef<HTMLDivElement>(null);

    const saveScrollPosition = () => {
        if (navRef.current) {
            const position = navRef.current.scrollTop;
            sessionStorage.setItem('sidebarScrollPosition', position.toString());
            console.log('Saving scroll position to sessionStorage:', position);
        }
    };

    // Восстанавливаем скролл при монтировании
    useEffect(() => {
        const restoreScroll = () => {
            const savedPosition = sessionStorage.getItem('sidebarScrollPosition');
            if (navRef.current && savedPosition) {
                const position = parseInt(savedPosition, 10);
                console.log('Restoring scroll position from sessionStorage:', position);
                navRef.current.scrollTop = position;
            }
        };

        // Восстанавливаем скролл после небольшой задержки
        const timeoutId = setTimeout(restoreScroll, 200);

        return () => clearTimeout(timeoutId);
    }, []); // Пустой массив зависимостей - выполняется только при монтировании

    return (
        <SidebarScrollContext.Provider value={{ saveScrollPosition }}>
            <div ref={navRef} className={styles.nav}>
                {children}
            </div>
        </SidebarScrollContext.Provider>
    );
}
