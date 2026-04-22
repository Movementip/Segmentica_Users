"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
    className?: string;
    onThemeChange?: (theme: "light" | "dark") => void | Promise<void>;
}

export function ModeToggle({ className, onThemeChange }: ModeToggleProps) {
    const { theme, resolvedTheme, setTheme } = useTheme();

    const isDark = theme === "dark" || resolvedTheme === "dark";

    const handleClick = () => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        void onThemeChange?.(nextTheme);
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={isDark ? "Включить светлую тему" : "Включить темную тему"}
            onClick={handleClick}
            className={cn("relative h-10 w-10 rounded-xl", className)}
        >
            <Sun className="h-[1.15rem] w-[1.15rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-[1.15rem] w-[1.15rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Сменить тему</span>
        </Button>
    );
}
