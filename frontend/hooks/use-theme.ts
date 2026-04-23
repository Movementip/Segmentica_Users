import * as React from "react";

import { ThemeContext, type ThemeContextValue } from "../components/theme-provider";

export function useTheme(): ThemeContextValue {
    const context = React.useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
