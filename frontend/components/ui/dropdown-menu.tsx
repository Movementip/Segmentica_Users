import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = MenuPrimitive.Root;
const DropdownMenuGroup = MenuPrimitive.Group;
const DropdownMenuPortal = MenuPrimitive.Portal;
const DropdownMenuSub = MenuPrimitive.SubmenuRoot;
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

function DropdownMenuTrigger({
    className,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
    return (
        <MenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            className={cn(className)}
            {...props}
        />
    );
}

function DropdownMenuContent({
    className,
    align = "end",
    sideOffset = 8,
    matchTriggerWidth,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> & Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "align" | "side" | "sideOffset"> & {
    matchTriggerWidth?: boolean;
}) {
    return (
        <DropdownMenuPortal>
            <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-content"
                    className={cn(
                        "segmentica-overlay z-50 min-w-40 overflow-hidden rounded-xl border p-1 shadow-xl outline-none",
                        matchTriggerWidth && "min-w-(--anchor-width) w-(--anchor-width)",
                        className,
                    )}
                    {...props}
                />
            </MenuPrimitive.Positioner>
        </DropdownMenuPortal>
    );
}

function DropdownMenuItem({
    className,
    inset,
    variant = "default",
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
}) {
    return (
        <MenuPrimitive.Item
            data-slot="dropdown-menu-item"
            data-inset={inset}
            data-variant={variant}
            className={cn(
                "segmentica-overlay-item relative flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-[var(--chrome-hover)] data-highlighted:text-[var(--chrome-foreground)] data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset=true]:pl-8 data-[variant=destructive]:text-destructive",
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuCheckboxItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
    return (
        <MenuPrimitive.CheckboxItem
            data-slot="dropdown-menu-checkbox-item"
            className={cn(
                "segmentica-overlay-item relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-none transition-colors data-highlighted:bg-[var(--chrome-hover)] data-highlighted:text-[var(--chrome-foreground)] data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <MenuPrimitive.CheckboxItemIndicator>
                    <CheckIcon className="size-3.5" />
                </MenuPrimitive.CheckboxItemIndicator>
            </span>
            {children}
        </MenuPrimitive.CheckboxItem>
    );
}

function DropdownMenuRadioItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
    return (
        <MenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            className={cn(
                "segmentica-overlay-item relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-none transition-colors data-highlighted:bg-[var(--chrome-hover)] data-highlighted:text-[var(--chrome-foreground)] data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <MenuPrimitive.RadioItemIndicator>
                    <CircleIcon className="size-2 fill-current" />
                </MenuPrimitive.RadioItemIndicator>
            </span>
            {children}
        </MenuPrimitive.RadioItem>
    );
}

function DropdownMenuLabel({
    className,
    inset,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.GroupLabel> & { inset?: boolean }) {
    return (
        <MenuPrimitive.GroupLabel
            data-slot="dropdown-menu-label"
            data-inset={inset}
            className={cn("segmentica-overlay-item px-2 py-1.5 text-sm font-medium data-[inset=true]:pl-8", className)}
            {...props}
        />
    );
}

function DropdownMenuSeparator({
    className,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
    return (
        <MenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            {...props}
        />
    );
}

function DropdownMenuShortcut({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
            {...props}
        />
    );
}

function DropdownMenuSubTrigger({
    className,
    inset,
    children,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & { inset?: boolean }) {
    return (
        <MenuPrimitive.SubmenuTrigger
            data-slot="dropdown-menu-sub-trigger"
            data-inset={inset}
            className={cn(
                "segmentica-overlay-item flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-[var(--chrome-hover)] data-highlighted:text-[var(--chrome-foreground)] data-[inset=true]:pl-8",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronRightIcon className="ml-auto size-4" />
        </MenuPrimitive.SubmenuTrigger>
    );
}

function DropdownMenuSubContent({
    className,
    sideOffset = 8,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> & Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "align" | "side" | "sideOffset">) {
    return (
        <MenuPrimitive.Portal>
            <MenuPrimitive.Positioner sideOffset={sideOffset} className="z-50">
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-sub-content"
                    className={cn(
                        "segmentica-overlay z-50 min-w-40 overflow-hidden rounded-xl border p-1 shadow-xl outline-none",
                        className,
                    )}
                    {...props}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
}

export {
    DropdownMenu,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
};
