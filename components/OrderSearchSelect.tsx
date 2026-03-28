import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Text, TextField, Theme, useThemeContext } from '@radix-ui/themes';
import styles from './CreateOrderModal.module.css';

type SearchSelectOption = {
    value: string;
    label: string;
};

interface OrderSearchSelectProps {
    label?: string;
    value: string;
    options: SearchSelectOption[];
    onValueChange: (value: string) => void;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
    emptyText?: string;
    compact?: boolean;
    inputClassName?: string;
    menuClassName?: string;
    menuPlacement?: 'top' | 'bottom';
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

function ThickCheckIcon({ className }: { className?: string }): JSX.Element {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.53547 0.62293C8.88226 0.849446 8.97976 1.3142 8.75325 1.66099L4.5083 8.1599C4.38833 8.34356 4.19397 8.4655 3.9764 8.49358C3.75883 8.52167 3.53987 8.45309 3.3772 8.30591L0.616113 5.80777C0.308959 5.52987 0.285246 5.05559 0.563148 4.74844C0.84105 4.44128 1.31533 4.41757 1.62249 4.69547L3.73256 6.60459L7.49741 0.840706C7.72393 0.493916 8.18868 0.396414 8.53547 0.62293Z"
            />
        </svg>
    );
}

export default function OrderSearchSelect({
    label,
    value,
    options,
    onValueChange,
    placeholder,
    required = false,
    disabled = false,
    emptyText = 'Ничего не найдено',
    compact = false,
    inputClassName = '',
    menuClassName = '',
    menuPlacement = compact ? 'top' : 'bottom',
}: OrderSearchSelectProps): JSX.Element {
    const themeContext = useThemeContext();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightedValue, setHighlightedValue] = useState<string | null>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const [isTypingSearch, setIsTypingSearch] = useState(false);
    const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom'>(menuPlacement);

    const prepareMenuOpening = () => {
        const inputElement = inputRef.current;
        if (!inputElement) return;

        const rect = inputElement.getBoundingClientRect();
        const gap = 8;
        const fallbackTop = menuPlacement === 'top'
            ? Math.max(12, rect.top - gap - 240)
            : rect.bottom + gap;
        setResolvedSide(menuPlacement);

        setMenuStyle({
            position: 'fixed',
            top: fallbackTop,
            left: rect.left,
            width: rect.width,
            maxHeight: 280,
            zIndex: 2147483647,
            pointerEvents: 'auto',
            visibility: 'hidden',
        });
    };

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) || null,
        [options, value]
    );

    useEffect(() => {
        setQuery(selectedOption?.label || '');
        setIsTypingSearch(false);
    }, [selectedOption]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
                setIsOpen(false);
                setHighlightedValue(null);
                setQuery(selectedOption?.label || '');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, selectedOption]);

    const filteredOptions = useMemo(() => {
        if (isOpen && !isTypingSearch) {
            return options;
        }
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return options;
        return options.filter((option) => normalize(option.label).includes(normalizedQuery));
    }, [isOpen, isTypingSearch, options, query]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setMenuStyle({ visibility: 'hidden' });
            return;
        }

        let menuResizeObserver: ResizeObserver | null = null;

        const updateMenuPosition = () => {
            const inputElement = inputRef.current;
            const menuElement = menuRef.current;
            if (!inputElement) return;

            const rect = inputElement.getBoundingClientRect();
            const viewportPadding = 12;
            const gap = 8;
            const topSpace = Math.max(0, rect.top - viewportPadding - gap);
            const bottomSpace = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
            const measuredHeight = menuElement?.offsetHeight || Math.min(Math.max(filteredOptions.length * 48 + 16, 72), 240);
            const preferredPlacement = menuPlacement;

            let actualPlacement: 'top' | 'bottom';
            if (preferredPlacement === 'top') {
                actualPlacement = topSpace >= Math.min(measuredHeight, 240) || topSpace >= bottomSpace ? 'top' : 'bottom';
            } else {
                actualPlacement = bottomSpace >= Math.min(measuredHeight, 240) || bottomSpace >= topSpace ? 'bottom' : 'top';
            }
            setResolvedSide(actualPlacement);

            const availableHeight = actualPlacement === 'top' ? topSpace : bottomSpace;
            const maxHeight = Math.max(120, Math.min(280, availableHeight));
            const menuHeight = Math.min(measuredHeight, maxHeight);
            const top = actualPlacement === 'top'
                ? Math.max(viewportPadding, rect.top - gap - menuHeight)
                : Math.min(window.innerHeight - viewportPadding - menuHeight, rect.bottom + gap);

            setMenuStyle({
                position: 'fixed',
                top,
                left: rect.left,
                width: rect.width,
                maxHeight,
                zIndex: 2147483647,
                pointerEvents: 'auto',
                visibility: 'visible',
            });
        };

        updateMenuPosition();
        if (menuRef.current && typeof ResizeObserver !== 'undefined') {
            menuResizeObserver = new ResizeObserver(() => updateMenuPosition());
            menuResizeObserver.observe(menuRef.current);
        }
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);
        return () => {
            menuResizeObserver?.disconnect();
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [filteredOptions.length, isOpen, menuPlacement, query]);

    const field = (
        <div ref={rootRef} className={styles.searchSelect}>
            <TextField.Root
                ref={inputRef}
                value={query}
                onClick={() => {
                    if (disabled) return;
                    prepareMenuOpening();
                    setIsTypingSearch(false);
                    setHighlightedValue(value || null);
                    setIsOpen(true);
                }}
                onChange={(event) => {
                    if (disabled) return;
                    setQuery(event.target.value);
                    setIsTypingSearch(true);
                    if (!isOpen) {
                        prepareMenuOpening();
                        setIsOpen(true);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setIsOpen(false);
                        setIsTypingSearch(false);
                        setQuery(selectedOption?.label || '');
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        prepareMenuOpening();
                        setIsTypingSearch(false);
                        setHighlightedValue(value || null);
                        setIsOpen(true);
                    }
                    if (event.key === 'Enter' && filteredOptions.length > 0) {
                        event.preventDefault();
                        const firstOption = filteredOptions[0];
                        onValueChange(firstOption.value);
                        setQuery(firstOption.label);
                        setIsTypingSearch(false);
                        setIsOpen(false);
                    }
                }}
                placeholder={placeholder}
                className={`${styles.textField} ${styles.searchSelectInput} ${inputClassName}`.trim()}
                size="2"
                disabled={disabled}
            />
            {isOpen && !disabled
                ? createPortal(
                    <Theme
                        asChild
                        appearance={themeContext.appearance}
                        accentColor={themeContext.accentColor}
                        grayColor={themeContext.resolvedGrayColor}
                        panelBackground={themeContext.panelBackground}
                        radius={themeContext.radius}
                        scaling={themeContext.scaling}
                        hasBackground={false}
                    >
                        <div
                            ref={menuRef}
                            className={`rt-PopperContent rt-SelectContent rt-r-size-2 rt-variant-solid rt-high-contrast ${styles.searchSelectMenu} ${menuClassName}`.trim()}
                            style={menuStyle}
                            data-accent-color="gray"
                            data-state="open"
                            data-side={resolvedSide}
                        >
                            <div className="rt-SelectViewport">
                                {filteredOptions.length === 0 ? (
                                    <div className={styles.searchSelectEmpty}>{emptyText}</div>
                                ) : (
                                    filteredOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={`rt-SelectItem ${styles.searchSelectOption}${option.value === value ? ` ${styles.searchSelectOptionSelected}` : ''}`.trim()}
                                            data-highlighted={highlightedValue === option.value ? '' : undefined}
                                            data-state={option.value === value ? 'checked' : 'unchecked'}
                                            onMouseEnter={() => setHighlightedValue(option.value)}
                                            onMouseLeave={() => setHighlightedValue((current) => (current === option.value ? null : current))}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                onValueChange(option.value);
                                                setQuery(option.label);
                                                setIsTypingSearch(false);
                                                setHighlightedValue(null);
                                                setIsOpen(false);
                                            }}
                                        >
                                            <span className={`rt-SelectItemIndicator ${styles.searchSelectOptionIndicator}`.trim()}>
                                                {option.value === value ? (
                                                    <ThickCheckIcon className={`rt-SelectItemIndicatorIcon ${styles.searchSelectOptionCheck}`.trim()} />
                                                ) : null}
                                            </span>
                                            <span className={styles.searchSelectOptionLabel}>{option.label}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </Theme>,
                    document.body
                )
                : null}
        </div>
    );

    if (compact || !label) {
        return field;
    }

    return (
        <Box className={styles.formGroup}>
            <Text as="label" size="2" weight="medium">
                {label}{required ? ' *' : ''}
            </Text>
            {field}
        </Box>
    );
}
