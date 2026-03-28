import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Text, TextField } from '@radix-ui/themes';
import { CheckIcon } from '@radix-ui/react-icons';
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
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) || null,
        [options, value]
    );

    useEffect(() => {
        setQuery(selectedOption?.label || '');
    }, [selectedOption]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
                setIsOpen(false);
                setQuery(selectedOption?.label || '');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, selectedOption]);

    const filteredOptions = useMemo(() => {
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return options;
        return options.filter((option) => normalize(option.label).includes(normalizedQuery));
    }, [options, query]);

    useLayoutEffect(() => {
        if (!isOpen) return;

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
            });
        };

        const frameId = window.requestAnimationFrame(updateMenuPosition);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);
        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [filteredOptions.length, isOpen, menuPlacement]);

    const field = (
        <div ref={rootRef} className={styles.searchSelect}>
            <TextField.Root
                ref={inputRef}
                value={query}
                onFocus={() => {
                    if (disabled) return;
                    setIsOpen(true);
                }}
                onChange={(event) => {
                    if (disabled) return;
                    setQuery(event.target.value);
                    setIsOpen(true);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setIsOpen(false);
                        setQuery(selectedOption?.label || '');
                    }
                    if (event.key === 'Enter' && filteredOptions.length > 0) {
                        event.preventDefault();
                        const firstOption = filteredOptions[0];
                        onValueChange(firstOption.value);
                        setQuery(firstOption.label);
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
                    <div
                        ref={menuRef}
                        className={`${styles.searchSelectMenu} ${menuClassName}`.trim()}
                        style={menuStyle}
                    >
                        {filteredOptions.length === 0 ? (
                            <div className={styles.searchSelectEmpty}>{emptyText}</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`${styles.searchSelectOption}${option.value === value ? ` ${styles.searchSelectOptionSelected}` : ''}`}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        onValueChange(option.value);
                                        setQuery(option.label);
                                        setIsOpen(false);
                                    }}
                                >
                                    {option.value === value ? (
                                        <CheckIcon className={styles.searchSelectOptionCheck} />
                                    ) : (
                                        <span className={styles.searchSelectOptionCheckSpacer} />
                                    )}
                                    <span className={styles.searchSelectOptionLabel}>{option.label}</span>
                                </button>
                            ))
                        )}
                    </div>,
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
