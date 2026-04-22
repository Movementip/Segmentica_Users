import type { Metadata } from "next";
import type React from "react";

import { ThemeProvider } from "@/components/theme-provider";

import "../styles/globals.css";

export const metadata: Metadata = {
    title: "Segmentica CRM",
    description: "Рабочий интерфейс Segmentica CRM",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem={false}
                    disableTransitionOnChange
                    storageKey="segmentica-theme"
                >
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
