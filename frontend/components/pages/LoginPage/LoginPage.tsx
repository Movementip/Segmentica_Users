import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import React from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import {
    Autocomplete,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from '@/components/ui/autocomplete';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type EmployeeItem = { id: number; fio: string; position: string | null };

type LoginPageProps = {
    query: string;
    selectedEmployee: EmployeeItem | null;
    suggestions: EmployeeItem[];
    suggestionsOpen: boolean;
    loading: boolean;
    password: string;
    showPassword: boolean;
    rememberMe: boolean;
    error: string | null;
    passwordFieldError: boolean;
    canSubmit: boolean;
    submitting: boolean;
    employeeInputRef: React.RefObject<HTMLInputElement | null>;
    passwordInputRef: React.RefObject<HTMLInputElement | null>;
    onQueryChange: (value: string) => void;
    onEmployeeFocus: () => void;
    onEmployeeBlur: () => void;
    onEmployeeEnter: () => void;
    onEmployeePick: (employee: EmployeeItem) => void;
    onPasswordChange: (value: string) => void;
    onPasswordToggle: () => void;
    onPasswordEnter: () => void;
    onRememberMeChange: (checked: boolean) => void;
    onSubmit: () => void;
};

type FieldShellProps = {
    htmlFor: string;
    label: string;
    helper?: React.ReactNode;
    children: React.ReactNode;
};

function FieldShell({ htmlFor, label, helper, children }: FieldShellProps): JSX.Element {
    return (
        <div className="space-y-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {helper ? (
                <div className="flex min-h-[1.25rem] items-center justify-between gap-3 text-sm text-muted-foreground">
                    {helper}
                </div>
            ) : null}
        </div>
    );
}

type IconInputProps = {
    id: string;
    name: string;
    value: string;
    placeholder: string;
    type?: React.HTMLInputTypeAttribute;
    icon: React.ReactNode;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    className?: string;
    onChange: (value: string) => void;
    onEnter?: () => void;
    trailing?: React.ReactNode;
};

function IconInput({
    id,
    name,
    value,
    placeholder,
    type = 'text',
    icon,
    inputRef,
    className,
    onChange,
    onEnter,
    trailing,
}: IconInputProps): JSX.Element {
    return (
        <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {icon}
            </div>
            <Input
                id={id}
                name={name}
                ref={inputRef}
                type={type}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                className={cn(
                    'h-12 rounded-xl bg-muted pl-10 pr-4 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-3',
                    trailing ? 'pr-12' : '',
                    className,
                )}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onEnter?.();
                    }
                }}
            />
            {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
        </div>
    );
}

export function LoginPageView({
    query,
    selectedEmployee,
    suggestions,
    suggestionsOpen,
    loading,
    password,
    showPassword,
    rememberMe,
    error,
    passwordFieldError,
    canSubmit,
    submitting,
    employeeInputRef,
    passwordInputRef,
    onQueryChange,
    onEmployeeFocus,
    onEmployeeBlur,
    onEmployeeEnter,
    onEmployeePick,
    onPasswordChange,
    onPasswordToggle,
    onPasswordEnter,
    onRememberMeChange,
    onSubmit,
}: LoginPageProps): JSX.Element {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground transition-colors sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,var(--foreground)_8%,transparent),_transparent_35%),radial-gradient(circle_at_bottom,_color-mix(in_oklch,var(--foreground)_7%,transparent),_transparent_24%)]" />

            <Card className="relative z-10 w-full max-w-md overflow-visible border-border bg-card text-card-foreground shadow-[0_28px_90px_color-mix(in_oklch,var(--foreground)_14%,transparent)] backdrop-blur">
                <CardHeader className="space-y-4 pb-8 text-center">
                    <div className="flex justify-end">
                        <ModeToggle />
                    </div>

                    <div className="mx-auto flex h-21 w-21 items-center justify-center rounded-3xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo-icon.png"
                            alt="Компания"
                            className="h-21 w-21 object-contain"
                        />
                    </div>

                    <div className="space-y-3">
                        <CardTitle className="text-3xl">Вход в систему</CardTitle>
                        <CardDescription className="text-base leading-7">
                            Введите данные сотрудника для доступа к рабочему профилю.
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="sr-only" aria-hidden="true">
                        <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                        <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
                    </div>

                    <FieldShell
                        htmlFor="employee_lookup"
                        label="Сотрудник"
                        helper={
                            <>
                                <span>{selectedEmployee?.position ?? ''}</span>
                                {loading ? <span>Поиск...</span> : null}
                            </>
                        }
                    >
                        <Autocomplete<EmployeeItem>
                            items={suggestions}
                            value={query}
                            open={suggestionsOpen}
                            mode="none"
                            filter={null}
                            inline
                            autoHighlight="always"
                            openOnInputClick
                            itemToStringValue={(employee) => employee.fio}
                            onValueChange={onQueryChange}
                            onOpenChange={(open) => {
                                if (open) onEmployeeFocus();
                            }}
                        >
                            <div className="relative">
                                <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                </div>
                                <AutocompleteInput
                                    id="employee_lookup"
                                    name="employee_lookup"
                                    ref={employeeInputRef}
                                    placeholder="ФИО сотрудника"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    data-1p-ignore="true"
                                    data-lpignore="true"
                                    className="h-12 rounded-xl bg-muted pl-10 pr-4 text-base shadow-none"
                                    onFocus={onEmployeeFocus}
                                    onBlur={onEmployeeBlur}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            onEmployeeEnter();
                                        }
                                    }}
                                />
                                {suggestionsOpen ? (
                                    <div className="segmentica-overlay absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-72 overflow-hidden rounded-xl border p-1 shadow-xl">
                                        <AutocompleteList>
                                            {suggestions.map((employee, index) => (
                                                <AutocompleteItem
                                                    key={employee.id}
                                                    value={employee}
                                                    index={index}
                                                    onClick={() => onEmployeePick(employee)}
                                                >
                                                    <span className="truncate font-semibold">{employee.fio}</span>
                                                    {employee.position ? (
                                                        <span className="mt-1 text-muted-foreground">{employee.position}</span>
                                                    ) : null}
                                                </AutocompleteItem>
                                            ))}
                                        </AutocompleteList>
                                        <AutocompleteEmpty>
                                            {loading ? 'Ищем сотрудника...' : 'Сотрудник не найден'}
                                        </AutocompleteEmpty>
                                    </div>
                                ) : null}
                            </div>
                        </Autocomplete>
                    </FieldShell>

                    <FieldShell htmlFor="employee_password" label="Пароль">
                        <IconInput
                            id="employee_password"
                            name="employee_password"
                            value={password}
                            placeholder="Введите пароль"
                            type={showPassword ? 'text' : 'password'}
                            icon={<Lock className="h-4 w-4" />}
                            inputRef={passwordInputRef}
                            className={passwordFieldError ? 'border-destructive focus-visible:border-destructive' : ''}
                            onChange={onPasswordChange}
                            onEnter={onPasswordEnter}
                            trailing={(
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                    onClick={onPasswordToggle}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            )}
                        />
                    </FieldShell>

                    <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <Checkbox
                                className="h-5 w-5 rounded-[6px]"
                                checked={rememberMe}
                                onCheckedChange={(checked) => onRememberMeChange(checked === true)}
                            />
                            Запомнить меня
                        </label>

                        <div className="text-sm text-muted-foreground">
                            {selectedEmployee ? 'Профиль найден' : 'Выберите сотрудника'}
                        </div>
                    </div>

                    {error ? (
                        <Card className="border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-none">
                            {error}
                        </Card>
                    ) : null}

                    <Button
                        type="button"
                        disabled={!canSubmit}
                        onClick={onSubmit}
                        className="h-12 w-full rounded-xl text-base font-semibold shadow-[0_20px_60px_color-mix(in_oklch,var(--foreground)_18%,transparent)]"
                    >
                        {submitting ? 'Вход...' : 'Войти'}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
