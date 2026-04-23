import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { useTheme } from '@/hooks/use-theme';
import { LoginPageView } from '@/components/auth/LoginPage';
import { emitAuthSyncEvent } from '@/lib/auth-sync';
import type { EmployeeLookupItem } from '@/types/auth';

const normalizeFio = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

export default function LoginPage(): JSX.Element {
    const router = useRouter();
    const { theme, resolvedTheme } = useTheme();
    const employeeInputRef = useRef<HTMLInputElement | null>(null);
    const passwordInputRef = useRef<HTMLInputElement | null>(null);

    const [query, setQuery] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLookupItem | null>(null);
    const [suggestions, setSuggestions] = useState<EmployeeLookupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEmployeeFocused, setIsEmployeeFocused] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordFieldError, setPasswordFieldError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const redirectTarget = useMemo(() => {
        const nextParam = typeof router.query.next === 'string'
            ? router.query.next
            : Array.isArray(router.query.next)
                ? router.query.next[0]
                : '';

        if (!nextParam) return '/';
        if (!nextParam.startsWith('/')) return '/';
        if (nextParam.startsWith('//')) return '/';
        if (nextParam.startsWith('/login')) return '/';

        return nextParam;
    }, [router.query.next]);

    const syncAutofilledValues = useCallback(() => {
        const employeeValue = employeeInputRef.current?.value?.trim() || '';
        const passwordValue = passwordInputRef.current?.value || '';

        if (employeeValue && employeeValue !== query) {
            setQuery(employeeValue);
        }

        if (passwordValue && passwordValue !== password) {
            setPassword(passwordValue);
        }
    }, [password, query]);

    const resolveEmployeeByQuery = useCallback(async (rawQuery?: string) => {
        const nextQuery = typeof rawQuery === 'string' ? rawQuery : query;
        const normalizedQuery = normalizeFio(nextQuery);
        if (!normalizedQuery) return null;

        if (selectedEmployee && normalizeFio(selectedEmployee.fio) === normalizedQuery) {
            return selectedEmployee;
        }

        const fromSuggestions = suggestions.find((item) => normalizeFio(item.fio) === normalizedQuery) || null;
        if (fromSuggestions) {
            setSelectedEmployee(fromSuggestions);
            return fromSuggestions;
        }

        try {
            const res = await fetch(`/api/employees/search?q=${encodeURIComponent(nextQuery.trim())}`);
            if (!res.ok) return null;
            const data = (await res.json()) as EmployeeLookupItem[];
            const exactMatch = (Array.isArray(data) ? data : []).find((item) => normalizeFio(item.fio) === normalizedQuery) || null;
            if (exactMatch) {
                setSelectedEmployee(exactMatch);
                return exactMatch;
            }
        } catch (e) {
            console.error(e);
        }

        return null;
    }, [query, selectedEmployee, suggestions]);

    useEffect(() => {
        if (!selectedEmployee) return;
        const q = normalizeFio(query);
        const fio = normalizeFio(selectedEmployee.fio);
        if (q && fio && q === fio) return;
        setSelectedEmployee(null);
    }, [query, selectedEmployee]);

    useEffect(() => {
        if (passwordFieldError) setPasswordFieldError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [password]);

    useEffect(() => {
        if (passwordFieldError) setPasswordFieldError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEmployee?.id]);

    useEffect(() => {
        syncAutofilledValues();

        const timers = [
            window.setTimeout(syncAutofilledValues, 50),
            window.setTimeout(syncAutofilledValues, 250),
        ];

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [syncAutofilledValues]);

    useEffect(() => {
        const q = query.trim();
        if (selectedEmployee && normalizeFio(q) === normalizeFio(selectedEmployee.fio)) {
            return;
        }
        if (q.length < 2 && !isEmployeeFocused) {
            setSuggestions([]);
            return;
        }

        const controller = new AbortController();
        const t = window.setTimeout(async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/employees/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
                if (!res.ok) return;
                const data = (await res.json()) as EmployeeLookupItem[];
                setSuggestions(Array.isArray(data) ? data : []);
            } catch (e) {
                if ((e as { name?: string } | null)?.name === 'AbortError') return;
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(t);
            controller.abort();
        };
    }, [query, isEmployeeFocused, selectedEmployee]);

    const openEmployeesDropdown = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/employees/search?q=');
            if (!res.ok) return;
            const data = (await res.json()) as EmployeeLookupItem[];
            setSuggestions(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = useMemo(() => {
        return query.trim().length > 0 && password.trim().length > 0 && !submitting;
    }, [password, query, submitting]);

    const currentTheme = (theme === 'dark' || resolvedTheme === 'dark') ? 'dark' : 'light';

    const submit = async () => {
        syncAutofilledValues();

        const effectiveQuery = employeeInputRef.current?.value?.trim() || query.trim();
        const effectivePassword = passwordInputRef.current?.value || password;

        if (effectiveQuery && effectiveQuery !== query) {
            setQuery(effectiveQuery);
        }
        if (effectivePassword && effectivePassword !== password) {
            setPassword(effectivePassword);
        }

        const employee = await resolveEmployeeByQuery(effectiveQuery);

        if (!employee?.id) {
            setError('Сотрудник не найден. Выбери его из списка или проверь ФИО');
            return;
        }

        if (!effectivePassword.trim()) {
            setError('Введите пароль');
            setPasswordFieldError(true);
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setPasswordFieldError(false);
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employee.id, password: effectivePassword, rememberMe, theme: currentTheme }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'Ошибка входа');
                setPasswordFieldError(true);
                return;
            }
            emitAuthSyncEvent('login');
            if (typeof window !== 'undefined') {
                window.location.replace(redirectTarget);
                return;
            }
            await router.replace(redirectTarget);
        } catch (e) {
            console.error(e);
            setError('Ошибка входа');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Head>
                <title>Авторизация</title>
            </Head>
            <LoginPageView
                query={query}
                selectedEmployee={selectedEmployee}
                suggestions={suggestions}
                suggestionsOpen={isEmployeeFocused && selectedEmployee == null && (suggestions.length > 0 || loading)}
                loading={loading}
                password={password}
                showPassword={showPassword}
                rememberMe={rememberMe}
                error={error}
                passwordFieldError={passwordFieldError}
                canSubmit={canSubmit}
                submitting={submitting}
                employeeInputRef={employeeInputRef}
                passwordInputRef={passwordInputRef}
                onQueryChange={setQuery}
                onEmployeeFocus={() => {
                    setIsEmployeeFocused(true);
                    if (query.trim().length < 2) void openEmployeesDropdown();
                }}
                onEmployeeBlur={() => {
                    window.setTimeout(() => {
                        setIsEmployeeFocused(false);
                        void resolveEmployeeByQuery();
                    }, 120);
                }}
                onEmployeeEnter={() => {
                    void submit();
                }}
                onEmployeePick={(employee) => {
                    setSelectedEmployee(employee);
                    setQuery(employee.fio);
                    setSuggestions([]);
                }}
                onPasswordChange={setPassword}
                onPasswordToggle={() => setShowPassword((value) => !value)}
                onPasswordEnter={() => {
                    if (canSubmit) void submit();
                }}
                onRememberMeChange={setRememberMe}
                onSubmit={() => {
                    void submit();
                }}
            />
        </>
    );
}
