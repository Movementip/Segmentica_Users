import * as React from "react";
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";

import { cn } from "@/lib/utils";

const Autocomplete = AutocompletePrimitive.Root;
const AutocompletePortal = AutocompletePrimitive.Portal;

const AutocompleteInput = React.forwardRef<
    React.ElementRef<typeof AutocompletePrimitive.Input>,
    React.ComponentProps<typeof AutocompletePrimitive.Input>
>(({ className, ...props }, ref) => {
    return (
        <AutocompletePrimitive.Input
            ref={ref}
            data-slot="autocomplete-input"
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
                className,
            )}
            {...props}
        />
    );
});
AutocompleteInput.displayName = "AutocompleteInput";

function AutocompletePositioner({
    className,
    sideOffset = 8,
    ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Positioner>) {
    return (
        <AutocompletePrimitive.Positioner
            sideOffset={sideOffset}
            className={cn("z-[1100] w-[var(--anchor-width)]", className)}
            {...props}
        />
    );
}

function AutocompletePopup({
    className,
    ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Popup>) {
    return (
        <AutocompletePrimitive.Popup
            data-slot="autocomplete-popup"
            className={cn(
                "segmentica-overlay max-h-72 overflow-hidden rounded-xl border p-1 shadow-xl outline-none",
                className,
            )}
            {...props}
        />
    );
}

function AutocompleteList({
    className,
    ...props
}: React.ComponentProps<typeof AutocompletePrimitive.List>) {
    return (
        <AutocompletePrimitive.List
            data-slot="autocomplete-list"
            className={cn("max-h-72 overflow-y-auto", className)}
            {...props}
        />
    );
}

function AutocompleteItem({
    className,
    ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Item>) {
    return (
        <AutocompletePrimitive.Item
            data-slot="autocomplete-item"
            className={cn(
                "segmentica-overlay-item relative flex cursor-default select-none flex-col rounded-lg px-3 py-2 text-sm outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function AutocompleteEmpty({
    className,
    ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Empty>) {
    return (
        <AutocompletePrimitive.Empty
            data-slot="autocomplete-empty"
            className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    Autocomplete,
    AutocompletePortal,
    AutocompleteInput,
    AutocompletePositioner,
    AutocompletePopup,
    AutocompleteList,
    AutocompleteItem,
    AutocompleteEmpty,
};
