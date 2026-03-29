import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Badge, Box, Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './login.module.css';

type EmployeeItem = { id: number; fio: string; position: string | null };

const normalizeFio = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

export default function LoginPage(): JSX.Element {
    const router = useRouter();
    const { refresh } = useAuth();
    const employeeInputRef = useRef<HTMLInputElement | null>(null);
    const passwordInputRef = useRef<HTMLInputElement | null>(null);

    const [query, setQuery] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
    const [suggestions, setSuggestions] = useState<EmployeeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEmployeeFocused, setIsEmployeeFocused] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordFieldError, setPasswordFieldError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const resolveEmployeeByQuery = useCallback(async () => {
        const normalizedQuery = normalizeFio(query);
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
            const res = await fetch(`/api/employees/search?q=${encodeURIComponent(query.trim())}`);
            if (!res.ok) return null;
            const data = (await res.json()) as EmployeeItem[];
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
            window.setTimeout(syncAutofilledValues, 1000),
        ];

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncAutofilledValues();
            }
        };

        const onWindowFocus = () => {
            syncAutofilledValues();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onWindowFocus);

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onWindowFocus);
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
                const data = (await res.json()) as EmployeeItem[];
                setSuggestions(Array.isArray(data) ? data : []);
            } catch (e) {
                if ((e as any)?.name === 'AbortError') return;
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
            const data = (await res.json()) as EmployeeItem[];
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

    const submit = async () => {
        const employee = await resolveEmployeeByQuery();

        if (!employee?.id) {
            setError('Сотрудник не найден. Выбери его из списка или проверь ФИО');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setPasswordFieldError(false);
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employee.id, password, rememberMe }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'Ошибка входа');
                setPasswordFieldError(true);
                return;
            }
            await refresh();
            await router.push('/');
        } catch (e) {
            console.error(e);
            setError('Ошибка входа');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.left}>
                <div className={styles.leftInner}>
                    <div className={styles.hero}>
                        <div className={styles.logoBox}>
                            <div className={styles.logoInner}>
                                <Image
                                    src="/logo-icon.png"
                                    alt="Компания"
                                    fill
                                    sizes="120px"
                                    style={{ objectFit: 'contain' }}
                                />
                            </div>
                        </div>

                        <div className={styles.leftHeroTitle}>Добро пожаловать</div>
                        <div className={styles.leftHeroSubtitle}>Войдите в систему управления логистикой</div>
                    </div>

                    <Card size="3" className={styles.card}>
                        <Box style={{ padding: 28 }}>
                            <div className={styles.autofillTrap} aria-hidden="true">
                                <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                                <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
                            </div>
                            <Flex direction="column" gap="4">
                                <Box>
                                    <Heading as="h1" size="5">Вход в систему</Heading>
                                    <Text as="div" size="2" color="gray" style={{ marginTop: 6 }}>
                                        Введите учетные данные для доступа
                                    </Text>
                                </Box>

                                <Box>
                                    <Text as="label" size="2" weight="bold">Сотрудник</Text>
                                    <Box className={styles.field}>
                                        <div className={styles.dropdownAnchor}>
                                            <TextField.Root
                                                name="employee_lookup"
                                                className={styles.input}
                                                value={query}
                                                placeholder="ФИО сотрудника…"

                                                autoCapitalize="none"
                                                spellCheck={false}
                                                onChange={(e) => setQuery(e.target.value)}
                                                onFocus={() => {
                                                    setIsEmployeeFocused(true);
                                                    if (query.trim().length < 2) void openEmployeesDropdown();
                                                }}
                                                ref={employeeInputRef}
                                                onBlur={() => {
                                                    window.setTimeout(() => {
                                                        setIsEmployeeFocused(false);
                                                        void resolveEmployeeByQuery();
                                                    }, 120);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        void submit();
                                                    }
                                                }}
                                            >
                                                <TextField.Slot side="left">
                                                    <User size={18} />
                                                </TextField.Slot>
                                            </TextField.Root>

                                            {selectedEmployee == null && suggestions.length > 0 ? (
                                                <Card size="2" className={styles.suggestions}>
                                                    <Box>
                                                        {suggestions.map((s) => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                className={styles.suggestionBtn}
                                                                onClick={() => {
                                                                    setSelectedEmployee(s);
                                                                    setQuery(s.fio);
                                                                    setSuggestions([]);
                                                                }}
                                                            >
                                                                <Flex direction="column" gap="1">
                                                                    <Text size="2" weight="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {s.fio}
                                                                    </Text>
                                                                    {s.position ? (
                                                                        <Text size="2" color="gray" className={styles.positionText}>{s.position}</Text>
                                                                    ) : null}
                                                                </Flex>
                                                            </button>
                                                        ))}
                                                    </Box>
                                                </Card>
                                            ) : null}
                                        </div>

                                        <div className={styles.helperRow}>
                                            {selectedEmployee?.position ? (
                                                <Text size="2" color="gray" className={styles.positionText}>{selectedEmployee.position}</Text>
                                            ) : (
                                                <span />
                                            )}
                                            {loading ? (
                                                <Text size="1" color="gray">Поиск…</Text>
                                            ) : null}
                                        </div>
                                    </Box>
                                </Box>

                                <Box>
                                    <Text as="label" size="2" weight="bold">Пароль</Text>
                                    <Box className={styles.field}>
                                        <TextField.Root
                                            name="employee_password"
                                            className={`${styles.input} ${passwordFieldError ? styles.inputError : ''}`}
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Введите пароль…"

                                            autoCapitalize="none"
                                            spellCheck={false}
                                            ref={passwordInputRef}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (canSubmit) void submit();
                                                }
                                            }}
                                        >
                                            <TextField.Slot side="left">
                                                <Lock size={18} />
                                            </TextField.Slot>
                                            <TextField.Slot side="right">
                                                <button
                                                    type="button"
                                                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    className={styles.passwordToggle}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: 28,
                                                        height: 28,
                                                        border: 'none',
                                                        background: 'transparent',
                                                        cursor: 'pointer',
                                                        color: 'rgba(0,0,0,0.55)'
                                                    }}
                                                >
                                                    {showPassword ? <EyeOff size={28} /> : <Eye size={28} />}
                                                </button>
                                            </TextField.Slot>
                                        </TextField.Root>
                                    </Box>
                                </Box>

                                <div className={styles.metaRow}>
                                    <label className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        Запомнить меня
                                    </label>
                                </div>

                                {error ? (
                                    <Text as="div" size="2" color="red">{error}</Text>
                                ) : null}

                                <div className={styles.actions}>
                                    <Button
                                        type="button"
                                        variant="solid"
                                        color="gray"
                                        highContrast
                                        disabled={!canSubmit}
                                        onClick={() => void submit()}
                                        style={{ width: '100%' }}
                                    >
                                        {submitting ? 'Вход…' : 'Войти'}
                                    </Button>
                                </div>
                            </Flex>
                        </Box>
                    </Card>
                </div>
            </div>

            <div className={styles.right}>
                <div className={styles.rightInner}>
                    <div className={styles.pill}>
                        <span style={{ opacity: 0.9 }}>CRM система</span>
                    </div>

                    <div className={styles.rightHeroTitle}>
                        Система управления поставками и логистикой
                    </div>

                    <div className={styles.rightHeroSub}>
                        Единый интерфейс для работы с заявками, закупками и отгрузками.
                    </div>

                    <div className={styles.featureList}>
                        <div className={styles.feature}>
                            <div className={styles.featureTitle}>Работа с процессами</div>
                            <div className={styles.featureDesc}>
                                Поддержка основных операций со складом, заявками и документами.
                            </div>
                        </div>

                        <div className={styles.feature}>
                            <div className={styles.featureTitle}>Учет складских запасов</div>
                            <div className={styles.featureDesc}>
                                Отображение текущих остатков и движения товаров.
                            </div>
                        </div>

                        <div className={styles.feature}>
                            <div className={styles.featureTitle}>Отчетность</div>
                            <div className={styles.featureDesc}>
                                Формирование отчетов для анализа данных.
                            </div>
                        </div>
                    </div>

                    <div className={styles.stats}>
                        <div>
                            <div className={styles.statValue}>Склад</div>
                            <div className={styles.statLabel}>учет товаров</div>
                        </div>
                        <div>
                            <div className={styles.statValue}>Заявки</div>
                            <div className={styles.statLabel}>обработка запросов</div>
                        </div>
                        <div>
                            <div className={styles.statValue}>Отчеты</div>
                            <div className={styles.statLabel}>анализ данных</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
