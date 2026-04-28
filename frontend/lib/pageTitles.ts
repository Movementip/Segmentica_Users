const pageTitles: Record<string, string> = {
    '/': 'Дашборд',
    '/login': 'Авторизация',
    '/dashboard': 'Дашборд',
    '/bitrix-forms': 'Формы Битрикс24',
    '/orders': 'Заявки',
    '/warehouse': 'Склад',
    '/suppliers': 'Поставщики',
    '/transport': 'ТК',
    '/clients': 'Контрагенты',
    '/managers': 'Сотрудники',
    '/products': 'Товары',
    '/categories': 'Категории',
    '/purchases': 'Закупки',
    '/shipments': 'Отгрузки',
    '/documents': 'Документы',
    '/missing-products': 'Недостающие товары',
    '/archive': 'Архив',
    '/reports': 'Отчеты',
    '/reports/view': 'Просмотр отчета',
    '/settings': 'Настройки',
    '/admin': 'Администрирование',
    '/admin/audit': 'Аудит-лог',
    '/admin/data-exchange': 'Обмен данными',
    '/admin/finance': 'Финансы',
    '/admin/users': 'Пользователи',
    '/admin/roles': 'Роли',
    '/admin/permissions': 'Разрешения',
    '/admin/role-permissions': 'Права ролей',
    '/admin/schedule-board': 'График сотрудников',
    '/admin/settings': 'Настройки системы',
    '/500': 'Ошибка 500',
};

const detailTitleByPathname: Record<string, (id: string) => string> = {
    '/orders/[id]': (id) => `Заявка ${id}`,
    '/shipments/[id]': (id) => `Отгрузка ${id}`,
    '/purchases/[id]': (id) => `Закупка ${id}`,
    '/products/[id]': (id) => `Товар ${id}`,
    '/warehouse/[id]': (id) => `Склад ${id}`,
    '/suppliers/[id]': (id) => `Поставщик ${id}`,
    '/transport/[id]': (id) => `ТК ${id}`,
    '/clients/[id]': (id) => `Контрагент ${id}`,
    '/managers/[id]': (id) => `Сотрудник ${id}`,
    '/categories/[id]': (id) => `Категория ${id}`,
};

const extractIdFromPath = (asPath?: string): string | undefined => {
    if (!asPath) return undefined;
    const cleanPath = asPath.split('?')[0]?.split('#')[0] || '';
    return cleanPath.split('/').filter(Boolean).pop();
};

export function resolvePageTitle(pathname?: string, id?: string | string[], asPath?: string): string {
    const path = pathname || '/dashboard';
    const staticTitle = pageTitles[path];
    if (staticTitle) return staticTitle;

    const resolver = detailTitleByPathname[path];
    const rawId = Array.isArray(id) ? id[0] : id;
    const titleId = rawId || extractIdFromPath(asPath);
    if (resolver && titleId?.trim()) return resolver(titleId);

    return 'Дашборд';
}
