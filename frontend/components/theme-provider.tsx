"use client";

import * as React from "react";

import {
    applyThemeToDocument,
    getInitialTheme,
    isTheme,
    type Theme,
} from "../lib/theme-runtime";

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
    attribute?: "class";
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
};

export type ThemeContextValue = {
    theme: Theme;
    resolvedTheme: Theme;
    setTheme: (theme: Theme) => void;
};

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
    children,
    defaultTheme = "light",
    storageKey = "theme",
    attribute = "class",
    enableSystem = false,
    disableTransitionOnChange = false,
}: ThemeProviderProps): JSX.Element {
    const [theme, setThemeState] = React.useState<Theme>(() => getInitialTheme(storageKey, defaultTheme));

    const setTheme = React.useCallback((nextTheme: Theme) => {
        if (!isTheme(nextTheme)) return;
        setThemeState((currentTheme) => (currentTheme === nextTheme ? currentTheme : nextTheme));
    }, []);

    React.useEffect(() => {
        if (attribute !== "class") return;
        applyThemeToDocument(theme, disableTransitionOnChange);
        try {
            window.localStorage.setItem(storageKey, theme);
        } catch {
            // ignore storage failures
        }
    }, [attribute, disableTransitionOnChange, storageKey, theme]);

    const value = React.useMemo<ThemeContextValue>(() => ({
        theme,
        resolvedTheme: theme,
        setTheme,
    }), [setTheme, theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
