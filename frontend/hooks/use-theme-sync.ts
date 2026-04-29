import { useEffect, useRef } from 'react';

import { isTheme } from '../lib/theme-runtime';
import { useTheme } from './use-theme';
import { useAuth } from '../hooks/use-auth';

export const useThemeSync = (): void => {
    const { user } = useAuth();
    const { setTheme } = useTheme();
    const savedTheme = user?.preferences?.theme;
    const lastAppliedUserIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!user) {
            lastAppliedUserIdRef.current = null;
            return;
        }
        if (lastAppliedUserIdRef.current === user.userId) return;
        if (!isTheme(savedTheme)) return;
        lastAppliedUserIdRef.current = user.userId;
        setTheme(savedTheme);
    }, [savedTheme, setTheme, user]);
};
