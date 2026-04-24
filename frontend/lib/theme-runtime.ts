export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'segmentica-theme';

export const isTheme = (value: unknown): value is Theme => {
    return value === 'light' || value === 'dark';
};

export const readStoredTheme = (storageKey: string): Theme | null => {
    if (typeof window === 'undefined') return null;

    try {
        const value = window.localStorage.getItem(storageKey);
        return isTheme(value) ? value : null;
    } catch {
        return null;
    }
};

export const getInitialTheme = (storageKey: string, fallbackTheme: Theme): Theme => {
    if (typeof window === 'undefined') return fallbackTheme;

    const root = document.documentElement;
    const attrTheme = root.dataset.theme;
    if (isTheme(attrTheme)) return attrTheme;
    if (root.classList.contains('dark')) return 'dark';
    if (root.classList.contains('light')) return 'light';

    return readStoredTheme(storageKey) ?? fallbackTheme;
};

const disableDocumentTransitions = (): (() => void) => {
    const styleNode = document.createElement('style');
    styleNode.appendChild(
        document.createTextNode(
            '*,*::before,*::after{-webkit-transition:none!important;transition:none!important;-webkit-animation:none!important;animation:none!important}'
        )
    );
    document.head.appendChild(styleNode);

    void window.getComputedStyle(document.body).opacity;

    return () => {
        void window.getComputedStyle(document.body).opacity;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                styleNode.remove();
            });
        });
    };
};

export const applyThemeToDocument = (theme: Theme, disableTransitionOnChange: boolean): void => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const restoreTransitions = disableTransitionOnChange ? disableDocumentTransitions() : null;

    const apply = (target: HTMLElement | null) => {
        if (!target) return;
        target.classList.toggle('dark', theme === 'dark');
        target.classList.toggle('light', theme === 'light');
        target.dataset.theme = theme;
        target.style.colorScheme = theme;
    };

    apply(root);
    apply(body);

    restoreTransitions?.();
};

export const createThemeInitScript = (
    storageKey: string,
    fallbackTheme: Theme = 'light'
): string => {
    return `(function(){var key=${JSON.stringify(storageKey)};var theme=${JSON.stringify(fallbackTheme)};try{var stored=window.localStorage.getItem(key);if(stored==='dark'||stored==='light'){theme=stored;}}catch(e){}var apply=function(target){if(!target)return;target.classList.toggle('dark',theme==='dark');target.classList.toggle('light',theme==='light');target.dataset.theme=theme;target.style.colorScheme=theme;};apply(document.documentElement);if(document.body){apply(document.body);}else{document.addEventListener('DOMContentLoaded',function(){apply(document.body);},{once:true});}})();`;
};
