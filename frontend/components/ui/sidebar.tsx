import * as React from "react";

import { cn } from "@/lib/utils";

function Sidebar({
    className,
    ...props
}: React.ComponentProps<"aside">) {
    return (
        <aside
            data-slot="sidebar"
            className={cn("bg-sidebar text-sidebar-foreground", className)}
            {...props}
        />
    );
}

function SidebarHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-header"
            className={cn("shrink-0 px-4 pb-3 pt-4", className)}
            {...props}
        />
    );
}

const SidebarContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div">
>(function SidebarContent({ className, ...props }, ref) {
    return (
        <div
            ref={ref}
            data-slot="sidebar-content"
            className={cn("min-h-0 flex-1 overflow-y-auto", className)}
            {...props}
        />
    );
});

function SidebarGroup({
    className,
    ...props
}: React.ComponentProps<"section">) {
    return (
        <section
            data-slot="sidebar-group"
            className={cn("px-3 py-2", className)}
            {...props}
        />
    );
}

function SidebarGroupLabel({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group-label"
            className={cn(
                "mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenu({
    className,
    ...props
}: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu"
            className={cn("flex flex-col gap-1", className)}
            {...props}
        />
    );
}

function SidebarMenuItem({
    className,
    ...props
}: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-item"
            className={cn("list-none", className)}
            {...props}
        />
    );
}

function SidebarMenuButton({
    className,
    isActive,
    ...props
}: React.ComponentProps<"a"> & {
    isActive?: boolean;
}) {
    return (
        <a
            data-slot="sidebar-menu-button"
            data-active={isActive ? "true" : undefined}
            aria-current={isActive ? "page" : props["aria-current"]}
            className={cn(
                "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/72 outline-none transition-all",
                "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-hover-foreground)]",
                "focus-visible:bg-[var(--sidebar-hover)] focus-visible:text-[var(--sidebar-hover-foreground)] focus-visible:ring-2 focus-visible:ring-sidebar-ring/45",
                "data-[active=true]:bg-[var(--sidebar-active)] data-[active=true]:text-[var(--sidebar-active-foreground)]",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuIcon({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="sidebar-menu-icon"
            className={cn("flex size-7 shrink-0 items-center justify-center text-current transition-colors", className)}
            {...props}
        />
    );
}

export {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuIcon,
};
