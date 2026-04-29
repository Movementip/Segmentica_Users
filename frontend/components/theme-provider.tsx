"use client";

import * as React from "react";

import {
    applyThemeToDocument,
    getInitialTheme,
    isTheme,
    readStoredTheme,
    type Theme,
} from "../lib/theme-runtime";

declare global {
    interface Window {
        segmenticaElectronTheme?: {
            setTheme?: (theme: Theme) => void;
            onThemeChanged?: (callback: (theme: Theme) => void) => (() => void) | void;
        };
    }
}

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
    const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
    const announcedInitialThemeRef = React.useRef(false);

    const applyAndStoreTheme = React.useCallback((nextTheme: Theme) => {
        if (attribute !== "class") return;
        try {
            window.localStorage.setItem(storageKey, nextTheme);
        } catch {
            // ignore storage failures
        }
        applyThemeToDocument(nextTheme, disableTransitionOnChange);
    }, [attribute, disableTransitionOnChange, storageKey]);

    const setTheme = React.useCallback((nextTheme: Theme) => {
        if (!isTheme(nextTheme)) return;
        applyAndStoreTheme(nextTheme);
        broadcastChannelRef.current?.postMessage({ type: "theme", theme: nextTheme });
        window.segmenticaElectronTheme?.setTheme?.(nextTheme);
        setThemeState((currentTheme) => (currentTheme === nextTheme ? currentTheme : nextTheme));
    }, [applyAndStoreTheme]);

    React.useEffect(() => {
        applyAndStoreTheme(theme);
    }, [applyAndStoreTheme, theme]);

    React.useEffect(() => {
        const syncTheme = (nextTheme: unknown) => {
            if (!isTheme(nextTheme)) return;
            applyAndStoreTheme(nextTheme);
            setThemeState((currentTheme) => (currentTheme === nextTheme ? currentTheme : nextTheme));
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== storageKey) return;
            syncTheme(event.newValue);
        };

        const handleBroadcastMessage = (event: MessageEvent) => {
            if (event.data?.type !== "theme") return;
            syncTheme(event.data.theme);
        };

        window.addEventListener("storage", handleStorage);
        const channel = typeof BroadcastChannel !== "undefined"
            ? new BroadcastChannel("segmentica-theme")
            : null;
        broadcastChannelRef.current = channel;
        channel?.addEventListener("message", handleBroadcastMessage);
        const unsubscribeElectronTheme = window.segmenticaElectronTheme?.onThemeChanged?.(syncTheme);

        syncTheme(readStoredTheme(storageKey));
        if (!announcedInitialThemeRef.current) {
            announcedInitialThemeRef.current = true;
            window.segmenticaElectronTheme?.setTheme?.(getInitialTheme(storageKey, defaultTheme));
        }

        return () => {
            window.removeEventListener("storage", handleStorage);
            channel?.removeEventListener("message", handleBroadcastMessage);
            channel?.close();
            unsubscribeElectronTheme?.();
            if (broadcastChannelRef.current === channel) {
                broadcastChannelRef.current = null;
            }
        };
    }, [applyAndStoreTheme, defaultTheme, storageKey]);

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
