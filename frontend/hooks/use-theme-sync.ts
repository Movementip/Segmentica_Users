import { useEffect } from 'react';

import { isTheme } from '../lib/theme-runtime';
import { useTheme } from './use-theme';
import { useAuth } from '../hooks/use-auth';

export const useThemeSync = (): void => {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const savedTheme = user?.preferences?.theme;

    useEffect(() => {
        if (!isTheme(savedTheme)) return;
        if (theme === savedTheme) return;
        setTheme(savedTheme);
    }, [savedTheme, setTheme, theme]);
};
