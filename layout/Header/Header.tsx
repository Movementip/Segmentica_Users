import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import styles from './Header.module.css';
import { FiSearch, FiX, FiPackage, FiUser } from 'react-icons/fi';
import {
    FiShoppingBag,
    FiFolder,
    FiTruck,
    FiDatabase
} from 'react-icons/fi';
import { Box, Card, DropdownMenu, Flex, ScrollArea, Separator, Text, TextField } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { canUseAdminDataExchangePage } from '../../lib/dataExchangeConfig';
import { SystemGuidePopup, type SystemGuideStep } from './SystemGuidePopup';

interface SearchResult {
    id: string;
    type: 'product' | 'client' | 'order' | 'category' | 'supplier';
    title: string;
    subtitle: string;
    price?: number;
    date?: string;
    status?: string;
    phone?: string;
}

interface SearchResults {
    orders: SearchResult[];
    clients: SearchResult[];
    products: SearchResult[];
    categories: SearchResult[];
    suppliers: SearchResult[];
}

const SYSTEM_GUIDE_VERSION = 2;

type SystemGuidePreferences = {
    version: number;
    completed: boolean;
    furthestStep: number;
};

const SYSTEM_GUIDE_STEPS: SystemGuideStep[] = [
    {
        id: 'welcome',
        section: 'Быстрый старт',
        title: 'Как устроена система',
        caption: 'Общая карта',
        description: 'Система собрана вокруг одного операционного контура: заявка фиксирует потребность клиента, закупка закрывает недостающие позиции, отгрузка передает товар или документы, а финансы и отчеты помогают контролировать результат.',
        details: [
            'Основной маршрут: заявка -> закупка -> отгрузка -> документы и финансы.',
            'Служебные разделы открываются из профиля и зависят от ваших прав.',
            'Если пункт меню или кнопка не видны, чаще всего у роли нет соответствующего права.',
        ],
        imageSrc: '/system-guide/navigation.svg',
        imageAlt: 'Общая схема системы',
    },
    {
        id: 'navigation',
        section: 'Быстрый старт',
        title: 'Навигация и верхняя шапка',
        caption: 'Где что находится',
        description: 'Слева находится основное меню с рабочими разделами. В верхней шапке всегда доступны поиск, профиль пользователя, переключение темы, служебные переходы и статус подключения к базе.',
        details: [
            'Левое меню ведет в основные сущности: заявки, контрагенты, закупки, склад, товары, поставщики, ТК и отчеты.',
            'Профиль открывает дополнительные разделы: документы, финансы, график сотрудников, настройки, обмен данными, администрирование и аудит.',
            'Доступ к пунктам меню фильтруется по правам роли, поэтому у разных сотрудников набор пунктов может отличаться.',
        ],
        imageSrc: '/system-guide/navigation.png',
        imageAlt: 'Навигация и верхняя шапка',
    },
    {
        id: 'search',
        section: 'Быстрый старт',
        title: 'Глобальный поиск',
        caption: 'Быстрый вход',
        description: 'Поиск в шапке нужен для быстрого перехода в данные без ручного обхода меню. Он помогает находить заявки, клиентов, товары, категории и поставщиков, а затем сразу открывать нужную карточку.',
        details: [
            'Используйте поиск, когда знаете номер заявки, название клиента, товар, артикул или поставщика.',
            'Результаты сгруппированы по типам, чтобы не путать товар, контрагента и заявку.',
            'Из результата поиска лучше сразу переходить в карточку, потому что там собраны действия, документы и связанные данные.',
        ],
        imageSrc: '/system-guide/navigation.png',
        imageAlt: 'Иллюстрация глобального поиска и карточек',
    },
    {
        id: 'cards',
        section: 'Быстрый старт',
        title: 'Карточки сущностей',
        caption: 'Где выполняется работа',
        description: 'Основная работа происходит не в таблицах, а в карточках: там видны реквизиты, позиции, связанные документы, вложения, переходы к связанным сущностям и действия вроде печати, редактирования или удаления.',
        details: [
            'Таблица нужна для поиска и отбора, карточка нужна для действия.',
            'В карточках заявок, закупок и отгрузок есть единая кнопка печати с доступными документами.',
            'Если действие опасное или зависит от статуса, система показывает его только при наличии прав и подходящих условий.',
        ],
        imageSrc: '/system-guide/detailcard.png',
        imageAlt: 'Карточки сущностей в системе',
    },
    {
        id: 'counterparties',
        section: 'Контрагенты и товары',
        title: 'Клиенты и поставщики',
        caption: 'Кто участвует в сделке',
        description: 'Контрагенты используются в заявках, закупках, отгрузках и печатных формах. Поэтому реквизиты клиента или поставщика лучше вести аккуратно: ИНН, КПП, адрес, контакты, банковские данные и история операций влияют на документы.',
        details: [
            'Клиенты участвуют в заявках и отгрузках как покупатели или грузополучатели.',
            'Поставщики участвуют в закупках и входящих документах.',
            'История заказов, закупок, ассортимент и документы контрагента доступны из его карточки при наличии прав.',
        ],
        imageSrc: '/system-guide/klienty.png',
        imageAlt: 'Клиенты и поставщики',
    },
    {
        id: 'products',
        section: 'Контрагенты и товары',
        title: 'Товары, категории и склад',
        caption: 'Номенклатура',
        description: 'Товары, категории и склад формируют основу позиций в заявках и закупках. От типа позиции зависит логика печатных форм: товарные позиции, услуги, материалы и внеоборотные активы могут открывать разные документы.',
        details: [
            'Категории помогают структурировать номенклатуру и фильтровать склад.',
            'Склад показывает остатки, движения, ожидаемые поступления и заявки, которые ждут товар.',
            'Тип позиции важен для документов: товарная заявка открывает договор поставки и спецификацию, а услуга открывает акт и договор услуг.',
        ],
        imageSrc: '/system-guide/sklad.png',
        imageAlt: 'Товары, категории и склад',
    },
    {
        id: 'missing-products',
        section: 'Контрагенты и товары',
        title: 'Недостающие товары',
        caption: 'Что нужно докупить',
        description: 'Раздел недостающих товаров помогает увидеть позиции, которых не хватает для выполнения заявок. Это мост между продажами и закупками: менеджер видит потребность, закупка закрывает ее поступлением.',
        details: [
            'Недостающие позиции можно связывать с заявками.',
            'После закупки и поступления товар должен вернуться в складской контур.',
            'Права на управление недостающими товарами отделены от прав на просмотр.',
        ],
        imageSrc: '/system-guide/missprod.png',
        imageAlt: 'Недостающие товары',
    },
    {
        id: 'orders-list',
        section: 'Заявки',
        title: 'Список заявок',
        caption: 'Продажи и потребности',
        description: 'Заявка фиксирует потребность клиента: кто покупает, какие позиции нужны, какие количества, цены, даты и документы должны быть подготовлены до отгрузки.',
        details: [
            'В списке заявок удобно искать, фильтровать и открывать нужную карточку.',
            'Создание, редактирование, удаление, печать и экспорт заявки управляются отдельными правами.',
            'Из заявки можно переходить к закупкам и отгрузкам, если они связаны с этой заявкой.',
        ],
        imageSrc: '/system-guide/orders.png',
        imageAlt: 'Список и карточка заявки',
    },
    {
        id: 'order-documents',
        section: 'Заявки',
        title: 'Печатные формы заявки',
        caption: 'До отгрузки',
        description: 'В заявке показываются коммерческие и договорные документы до отгрузки. Счет доступен всегда, а договоры и спецификации зависят от состава позиций.',
        details: [
            'Чисто товарная заявка: счет на оплату, договор поставки, спецификация.',
            'Чисто услуга: счет, договор оказания услуг, договор подряда как ручной вариант, исходящий акт.',
            'Смешанная заявка: счет всегда, остальные документы выбираются вручную, чтобы не подставить неправильную форму.',
        ],
        imageSrc: '/system-guide/pechatorder.png',
        imageAlt: 'Печатные формы заявки',
    },
    {
        id: 'order-attachments',
        section: 'Заявки',
        title: 'Документы и вложения заявки',
        caption: 'Файлы рядом с карточкой',
        description: 'Кроме печатных форм у заявки могут быть вложения: дополнительные файлы, документы клиента, сканы, согласования или любые материалы, которые нужно хранить рядом с карточкой.',
        details: [
            'Просмотр, загрузка и удаление вложений управляются отдельными правами.',
            'Печатные формы формируются из шаблонов и реальных данных карточки.',
            'Вложенные файлы не заменяют печатные формы, это отдельный реестр документов по сущности.',
        ],
        imageSrc: '/system-guide/oderdoc.png',
        imageAlt: 'Вложения заявки',
    },
    {
        id: 'purchases-list',
        section: 'Закупки',
        title: 'Закупки',
        caption: 'Входящие документы',
        description: 'Закупка отражает работу с поставщиком: какие позиции закупаются, у кого, на какую сумму и к какой заявке это относится. Это входящий контур документов от поставщика.',
        details: [
            'Закупку можно создавать отдельно или из заявки, если нужно закрыть недостающие позиции.',
            'В карточке закупки есть переход обратно к заявке, если связь существует.',
            'Права на создание закупки из заявки и обычное создание закупки разделены.',
        ],
        imageSrc: '/system-guide/zakupki.png',
        imageAlt: 'Закупки в рабочем маршруте',
    },
    {
        id: 'purchase-documents',
        section: 'Закупки',
        title: 'Печатные формы закупки',
        caption: 'Счет, УПД, ТОРГ-12',
        description: 'В закупке показываются входящие документы от поставщика. Их можно держать параллельно, потому что в реальной работе поставщик может передать УПД или товарную накладную.',
        details: [
            'Счет доступен как входящий документ на основе текущего шаблона счета.',
            'УПД статус 1 используется, если поставщик передает документ со счетом-фактурой.',
            'УПД статус 2 используется без счета-фактуры, а ТОРГ-12 доступна как товарная накладная.',
        ],
        imageSrc: '/system-guide/zakupupd1.png',
        imageAlt: 'Печатные формы закупки',
    },
    {
        id: 'shipments-list',
        section: 'Отгрузки',
        title: 'Отгрузки',
        caption: 'Передача товара',
        description: 'Отгрузка фиксирует передачу товара или результата работ клиенту. Здесь важны статус, состав отгрузки, дата, связь с заявкой, перевозка и комплект документов передачи.',
        details: [
            'Отгрузка может быть связана с заявкой, чтобы видеть исходную потребность клиента.',
            'Состав отгрузки и позиции доступны отдельным правом просмотра.',
            'Статусы помогают отличать подготовку, доставку и завершенную передачу.',
        ],
        imageSrc: '/system-guide/otgruz.png',
        imageAlt: 'Отгрузки и передача товара',
    },
    {
        id: 'shipment-documents',
        section: 'Отгрузки',
        title: 'Печатные формы отгрузки',
        caption: 'УПД, ТОРГ-12, транспортная',
        description: 'В отгрузке показываются документы передачи и перевозки. УПД и ТОРГ-12 можно держать параллельно, а транспортная накладная нужна только когда есть доставка или перевозка.',
        details: [
            'Исходящий УПД статус 1 используется для передачи со счетом-фактурой.',
            'Исходящий УПД статус 2 используется для передачи без счета-фактуры.',
            'Транспортная накладная формируется по данным отгрузки, грузополучателя, маршрута и перевозчика.',
        ],
        imageSrc: '/system-guide/otruzpechat.png',
        imageAlt: 'Печатные формы отгрузки',
    },
    {
        id: 'transport',
        section: 'Отгрузки',
        title: 'Транспортные компании',
        caption: 'Логистика',
        description: 'Раздел транспортных компаний нужен для логистики: хранит карточки перевозчиков, статистику, активные отгрузки, последние отправки и историю по месяцам.',
        details: [
            'Права на просмотр карточки, статистики и вкладок транспортной компании разделены.',
            'Если транспортная компания участвует в отгрузке, ее данные могут попадать в транспортные документы.',
            'Импорт и экспорт транспортных компаний управляются отдельными правами.',
        ],
        imageSrc: '/system-guide/tk.png',
        imageAlt: 'Транспортные компании и логистика',
    },
    {
        id: 'finance',
        section: 'Финансы и сотрудники',
        title: 'Финансы',
        caption: 'Операции и печать',
        description: 'Финансы открываются из профильного меню при наличии права доступа. Внутри можно работать с финансовыми операциями и печатными формами, а действия печати и экспорта дополнительно проверяются по отдельным правам.',
        details: [
            'Доступ на страницу финансов проверяется правом admin.finance.',
            'Печать, PDF и Excel для финансов управляются отдельными правами finance.print, finance.export.pdf и finance.export.excel.',
            'Названия файлов и просмотр документов формируются по русской логике, как в заявках, закупках и отгрузках.',
        ],
        imageSrc: '/system-guide/fin.png',
        imageAlt: 'Финансы и печатные формы',
    },
    {
        id: 'schedule',
        section: 'Финансы и сотрудники',
        title: 'График сотрудников',
        caption: 'Смена и рабочее время',
        description: 'График сотрудников помогает планировать работу команды. Доступ к графику, управлению расписанием и редактированию своего графика разделен по ролям.',
        details: [
            'Сотрудник может иметь право редактировать только собственный график.',
            'Руководитель или администратор может управлять графиком сотрудников при наличии schedule.manage.',
            'Карточки сотрудников, документы сотрудников и импорт/экспорт также управляются отдельными правами.',
        ],
        imageSrc: '/system-guide/grafik.png',
        imageAlt: 'График сотрудников',
    },
    {
        id: 'documents-registry',
        section: 'Документы и отчеты',
        title: 'Общий реестр документов',
        caption: 'Файлы системы',
        description: 'Общий реестр документов нужен для хранения и привязки файлов к сущностям. Это не то же самое, что печатные формы: печатные формы генерируются из шаблонов, а реестр хранит загруженные файлы.',
        details: [
            'documents.view дает доступ к реестру документов.',
            'documents.upload, documents.attach и documents.delete отвечают за загрузку, привязку и удаление.',
            'Экспорт и импорт документов вынесены в отдельные права documents.export и documents.import.',
        ],
        imageSrc: '/system-guide/doc.png',
        imageAlt: 'Общий реестр документов',
    },
    {
        id: 'reports',
        section: 'Документы и отчеты',
        title: 'Отчеты',
        caption: 'Аналитика',
        description: 'Отчеты показывают сводки по продажам, товарам, клиентам, логистике, финансам и эффективности сотрудников. Некоторые отчеты имеют отдельные права на просмотр и экспорт.',
        details: [
            'reports.view_all и reports.export дают общий доступ к просмотру и экспорту.',
            'Пользовательские отчеты имеют точечные права вида reports.custom.*.view и reports.custom.*.export.*.',
            'Если отчет не виден, проверьте не только общий доступ к отчетам, но и конкретное право на вкладку или отчет.',
        ],
        imageSrc: '/system-guide/otchety.png',
        imageAlt: 'Отчеты и аналитика',
    },
    {
        id: 'permissions',
        section: 'Администрирование',
        title: 'Роли и права доступа',
        caption: 'Кто что может делать',
        description: 'Права в системе детальные: отдельно проверяется просмотр страницы, просмотр карточки, создание, редактирование, удаление, печать, экспорт и работа с вложениями. Поэтому интерфейс показывает только те действия, которые доступны текущей роли.',
        details: [
            'Раздел администрирования ролей доступен только директорскому контуру.',
            'Для печатных форм есть отдельные права: print, export.pdf, export.excel и export.word там, где формат применим.',
            'Проверка прав идет и на фронте, и на API, чтобы нельзя было открыть действие прямой ссылкой.',
        ],
        imageSrc: '/system-guide/prava.png',
        imageAlt: 'Роли и права доступа',
    },
    {
        id: 'settings',
        section: 'Администрирование',
        title: 'Настройки системы',
        caption: 'Правила работы',
        description: 'Системные настройки управляют поведением отдельных контуров: например, учетом ассортимента поставщиков, временем поставки и другими правилами, которые влияют на рабочий процесс.',
        details: [
            'Доступ к настройкам проверяется правом admin.settings.',
            'Некоторые настройки имеют отдельные права управления, чтобы не отдавать весь системный раздел целиком.',
            'Изменения настроек лучше делать осознанно: они могут поменять поведение закупок, склада и связанных операций.',
        ],
        imageSrc: '/system-guide/sett.png',
        imageAlt: 'Настройки системы',
    },
    {
        id: 'data-exchange',
        section: 'Администрирование',
        title: 'Обмен данными',
        caption: 'Импорт и экспорт',
        description: 'Обмен данными используется для массового импорта и экспорта сущностей: товаров, клиентов, поставщиков, заявок, закупок, отгрузок, склада, финансов и других разделов.',
        details: [
            'Страница обмена данными открывается только при наличии подходящих прав.',
            'Для каждого типа данных есть отдельные права export и import.',
            'Массовый импорт стоит запускать осторожно: он меняет много данных сразу.',
        ],
        imageSrc: '/system-guide/export.png',
        imageAlt: 'Обмен данными',
    },
    {
        id: 'audit',
        section: 'Администрирование',
        title: 'Аудит-лог и архив',
        caption: 'Контроль изменений',
        description: 'Аудит-лог помогает смотреть, кто и что менял в системе. Архивные разделы позволяют возвращаться к заявкам, закупкам, отгрузкам, выплатам и финансовым операциям, которые уже вынесены из основного рабочего потока.',
        details: [
            'Аудит доступен по праву admin.audit.',
            'Архивные списки и переходы в архивные карточки имеют отдельные права.',
            'Если нужно понять историю действия, начинайте с аудит-лога и карточки сущности.',
        ],
        imageSrc: '/system-guide/log.png',
        imageAlt: 'Аудит-лог и архив',
    },
    {
        id: 'finish',
        section: 'Завершение',
        title: 'Как пользоваться гайдом дальше',
        caption: 'Повторное открытие',
        description: 'После прохождения гайд можно закрывать и повторно открывать из профильного меню. В повторном режиме можно свободно перескакивать по разделам, потому что принудительное прохождение нужно только при первом знакомстве.',
        details: [
            'Первый запуск нельзя закрыть до последнего шага, чтобы пользователь увидел всю карту системы.',
            'Во время первого запуска можно перейти только к уже открытым шагам и к одному следующему.',
            'После завершения гайд становится справкой: его можно открыть, закрыть и читать в любом порядке.',
        ],
        imageSrc: '/system-guide/navigation.svg',
        imageAlt: 'Завершение системного гайда',
    },
];

const readSystemGuidePreferences = (preferences: Record<string, unknown> | undefined): SystemGuidePreferences => {
    const raw = preferences?.systemGuide;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            version: SYSTEM_GUIDE_VERSION,
            completed: false,
            furthestStep: 0,
        };
    }

    const value = raw as Record<string, unknown>;
    const version = typeof value.version === 'number' ? value.version : 0;
    const completed = Boolean(value.completed) && version === SYSTEM_GUIDE_VERSION;
    const furthestStep = typeof value.furthestStep === 'number' ? value.furthestStep : 0;

    return {
        version: SYSTEM_GUIDE_VERSION,
        completed,
        furthestStep: Math.max(0, Math.min(furthestStep, SYSTEM_GUIDE_STEPS.length - 1)),
    };
};

export function Header(): JSX.Element {
    const router = useRouter();
    const { user, logout, setTheme } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState<'default' | 'sku' | 'supplier' | 'category'>('default');
    const searchRef = useRef<HTMLDivElement>(null);
    const isNavigatingRef = useRef(false);
    const [searchResults, setSearchResults] = useState<SearchResults>({
        orders: [],
        clients: [],
        products: [],
        categories: [],
        suppliers: []
    });

    const [dbStatus, setDbStatus] = useState<{ isRemote: boolean; mode: 'local' | 'remote'; remoteAvailable: boolean } | null>(null);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [isDbSwitching, setIsDbSwitching] = useState(false);
    const can = (key: string) => Boolean(user?.permissions?.includes(key));
    const canViewAdminFinance = can('admin.finance');
    const canViewScheduleBoard = can('admin.schedule_board') || (can('managers.list') && can('schedule.manage'));
    const canViewAdminSettings = can('admin.settings');
    const canViewAdminAudit = can('admin.audit');
    const canViewAdminRbac = Boolean(user?.roles?.includes('director'));
    const canViewAdminDataExchange = canUseAdminDataExchangePage(user?.permissions);
    const canViewDocuments = can('documents.view');
    const initialSystemGuidePreferences = useMemo(
        () => readSystemGuidePreferences(user?.preferences),
        [user?.preferences]
    );
    const [isSystemGuideOpen, setIsSystemGuideOpen] = useState(false);
    const [systemGuideCompleted, setSystemGuideCompleted] = useState(initialSystemGuidePreferences.completed);
    const [systemGuideFurthestStep, setSystemGuideFurthestStep] = useState(initialSystemGuidePreferences.furthestStep);
    const initializedGuideUserIdRef = useRef<number | null>(null);

    const fetchDbStatus = async () => {
        try {
            const response = await fetch('/api/db-status');
            if (!response.ok) return;
            const data = await response.json();
            setDbStatus({
                isRemote: Boolean(data.isRemote),
                mode: data.mode === 'remote' ? 'remote' : 'local',
                remoteAvailable: Boolean(data.remoteAvailable)
            });
        } catch (error) {
            console.error('Failed to fetch DB status:', error);
        } finally {
            setIsDbLoading(false);
        }
    };

    useEffect(() => {
        fetchDbStatus();
        const t = window.setInterval(fetchDbStatus, 10000);
        return () => window.clearInterval(t);
    }, []);

    useEffect(() => {
        if (!user?.userId) return;
        if (initializedGuideUserIdRef.current === user.userId) return;

        initializedGuideUserIdRef.current = user.userId;
        setSystemGuideCompleted(initialSystemGuidePreferences.completed);
        setSystemGuideFurthestStep(initialSystemGuidePreferences.furthestStep);
        if (!initialSystemGuidePreferences.completed) {
            setIsSystemGuideOpen(true);
        }
    }, [initialSystemGuidePreferences.completed, initialSystemGuidePreferences.furthestStep, user?.userId]);

    const persistSystemGuideState = useCallback(async (nextState: { completed: boolean; furthestStep: number }) => {
        setSystemGuideCompleted(nextState.completed);
        setSystemGuideFurthestStep(nextState.furthestStep);

        try {
            await fetch('/api/auth/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patch: {
                        systemGuide: {
                            version: SYSTEM_GUIDE_VERSION,
                            completed: nextState.completed,
                            furthestStep: nextState.furthestStep,
                        },
                    },
                }),
            });
        } catch (error) {
            console.error('Failed to persist system guide state:', error);
        }
    }, []);

    const switchDbMode = async (mode: 'local' | 'remote') => {
        setIsDbSwitching(true);
        try {
            const response = await fetch('/api/db-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            if (!response.ok) return;
            await fetchDbStatus();
        } catch (error) {
            console.error('Failed to switch DB mode:', error);
        } finally {
            setIsDbSwitching(false);
        }
    };

    // Handle search input changes with debounce
    useEffect(() => {
        const search = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults({
                    orders: [],
                    clients: [],
                    products: [],
                    categories: [],
                    suppliers: []
                });
                return;
            }

            setIsSearching(true);
            try {
                const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
                const data = await response.json();
                setSearchResults({
                    orders: data.orders || [],
                    clients: data.clients || [],
                    products: data.products || [],
                    categories: data.categories || [],
                    suppliers: data.suppliers || []
                });
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults({
                    orders: [],
                    clients: [],
                    products: [],
                    categories: [],
                    suppliers: []
                });
            } finally {
                setIsSearching(false);
            }
        };

        const timerId = setTimeout(search, 300);
        return () => clearTimeout(timerId);
    }, [searchQuery]);

    // Close search results when clicking outside or when input loses focus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };

        const handleBlur = (event: FocusEvent) => {
            // Use setTimeout to allow click events to be processed before clearing
            setTimeout(() => {
                if (searchRef.current && !searchRef.current.contains(document.activeElement)) {
                    setIsSearchOpen(false);
                }
            }, 200);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('focusin', handleBlur);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('focusin', handleBlur);
        };
    }, []);

    useEffect(() => {
        const handleRouteEnd = () => {
            isNavigatingRef.current = false;
        };

        router.events.on('routeChangeComplete', handleRouteEnd);
        router.events.on('routeChangeError', handleRouteEnd);

        return () => {
            router.events.off('routeChangeComplete', handleRouteEnd);
            router.events.off('routeChangeError', handleRouteEnd);
        };
    }, [router.events]);

    const handleResultClick = (result: SearchResult) => {
        setIsSearchOpen(false);

        switch (result.type) {
            case 'product':
                void safePush(`/products/${result.id}`);
                break;
            case 'client':
                void safePush(`/clients/${result.id}`);
                break;
            case 'order':
                void safePush(`/orders/${result.id}`);
                break;
            case 'category':
                void safePush(`/categories/${result.id}`);
                break;
            case 'supplier':
                void safePush(`/suppliers/${result.id}`);
                break;
        }
    };

    const handleExampleClick = (value: string) => {
        setIsSearchOpen(true);
        setSearchMode('default');
        setSearchQuery(value);
        setTimeout(() => {
            const el = searchRef.current?.querySelector('input') as HTMLInputElement | null;
            el?.focus();
        }, 0);
    };

    const handleModeHintClick = (mode: 'sku' | 'supplier' | 'category') => {
        setIsSearchOpen(true);
        setSearchMode(mode);
        setTimeout(() => {
            const el = searchRef.current?.querySelector('input') as HTMLInputElement | null;
            el?.focus();
        }, 0);
    };

    const safePush = async (href: string) => {
        if (!href) return;
        if (isNavigatingRef.current) return;
        if (href === router.asPath || href === router.pathname) return;

        try {
            isNavigatingRef.current = true;
            await router.push(href);
        } catch (error) {
            isNavigatingRef.current = false;
            if ((error as { cancelled?: boolean } | null)?.cancelled) {
                return;
            }
            console.error('Navigation error:', error);
        }
    };

    const placeholder =
        searchMode === 'sku'
            ? 'Введите артикул / SKU…'
            : searchMode === 'supplier'
                ? 'Введите название поставщика…'
                : searchMode === 'category'
                    ? 'Введите категорию…'
                    : 'Например: заявка #5, Иванов, +7…';

    const showDropdown = isSearchOpen;
    const isQueryReady = searchQuery.trim().length >= 2;

    const hasResults =
        searchResults.orders.length > 0 ||
        searchResults.clients.length > 0 ||
        searchResults.products.length > 0 ||
        searchResults.categories.length > 0 ||
        searchResults.suppliers.length > 0;

    const getStatusColor = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'новая':
                return '#1976d2';
            case 'в обработке':
                return '#f57c00';
            case 'подтверждена':
                return '#7b1fa2';
            case 'в работе':
                return '#0288d1';
            case 'собрана':
                return '#5d4037';
            case 'отгружена':
                return '#00897b';
            case 'выполнена':
                return '#388e3c';
            case 'отменена':
                return '#d32f2f';
            default:
                return '#616161';
        }
    };

    const renderSectionHeader = (
        icon: React.ReactNode,
        title: string
    ) => (
        <Flex align="center" gap="2" className={styles.sectionHeader}>
            <Box className={styles.sectionHeaderIcon}>{icon}</Box>
            <Text size="3" weight="bold" color="gray">
                {title}
            </Text>
        </Flex>
    );

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <div className={styles.leftSpacer} />
            </div>

            <div className={styles.rightSection}>
                <div className={styles.searchWrapper} ref={searchRef}>
                    <TextField.Root
                        className={styles.searchField}
                        size="3"
                        variant="surface"
                        radius="large"
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        title="Поиск по всем разделам системы"
                    >
                        <TextField.Slot>
                            <FiSearch className={styles.searchIcon} />
                        </TextField.Slot>

                        {searchQuery ? (
                            <TextField.Slot>
                                <button
                                    type="button"
                                    className={styles.clearButton}
                                    onClick={() => {
                                        setSearchQuery('');
                                        setIsSearchOpen(true);
                                        setSearchResults({
                                            products: [],
                                            clients: [],
                                            orders: [],
                                            categories: [],
                                            suppliers: []
                                        });
                                    }}
                                    aria-label="Очистить поиск"
                                >
                                    <FiX size={18} />
                                </button>
                            </TextField.Slot>
                        ) : null}
                    </TextField.Root>

                    {showDropdown && (
                        <div className={styles.searchResults}>
                            <Card size="2" variant="surface" className={styles.searchCard}>
                                <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 520 }}>
                                    <Flex direction="column" className={styles.searchCardInner}>
                                        {!isQueryReady ? (
                                            <Box className={styles.searchEmpty}>
                                                <Text size="3" weight="bold">
                                                    Что можно найти
                                                </Text>
                                                <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                    Введи минимум 2 символа. Примеры:
                                                </Text>

                                                <div className={styles.exampleGrid}>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('заявка #5')}
                                                    >
                                                        заявка #5
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('ИП Иванов')}
                                                    >
                                                        ИП Иванов
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('+7')}
                                                    >
                                                        +7… (телефон)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('sku')}
                                                    >
                                                        артикул / SKU
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('supplier')}
                                                    >
                                                        поставщик
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('category')}
                                                    >
                                                        категория
                                                    </button>
                                                </div>
                                            </Box>
                                        ) : isSearching ? (
                                            <Box className={styles.loading}>
                                                <Text size="2" color="gray">
                                                    Загрузка...
                                                </Text>
                                            </Box>
                                        ) : hasResults ? (
                                            <>
                                                {searchResults.orders.length > 0 && (
                                                    <Box>
                                                        {renderSectionHeader(
                                                            <FiShoppingBag className={styles.sectionIcon} data-type="order" />,
                                                            'Заказы'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.orders.map((order) => (
                                                                <Box
                                                                    key={`order-${order.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="order"
                                                                    onClick={() => handleResultClick(order)}
                                                                >
                                                                    <Flex align="center" gap="2" wrap="wrap">
                                                                        <Text size="3" weight="bold">
                                                                            {order.title}
                                                                        </Text>
                                                                        {order.status ? (
                                                                            <div
                                                                                className={styles.statusBadge}
                                                                                style={{
                                                                                    backgroundColor: `${getStatusColor(order.status)}15`,
                                                                                    color: getStatusColor(order.status),
                                                                                    border: `1px solid ${getStatusColor(order.status)}40`
                                                                                }}
                                                                            >
                                                                                {order.status}
                                                                            </div>
                                                                        ) : null}
                                                                    </Flex>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {order.subtitle}
                                                                        {order.date && ` • ${order.date}`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.clients.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiUser className={styles.sectionIcon} data-type="client" />,
                                                            'Клиенты'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.clients.map((client) => (
                                                                <Box
                                                                    key={`client-${client.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="client"
                                                                    onClick={() => handleResultClick(client)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {client.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {client.subtitle}
                                                                        {client.date && ` • ${client.date}`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.products.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiPackage className={styles.sectionIcon} data-type="product" />,
                                                            'Товары'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.products.map((product) => (
                                                                <Box
                                                                    key={`product-${product.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="product"
                                                                    onClick={() => handleResultClick(product)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {product.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {product.subtitle}
                                                                        {typeof product.price === 'number' && ` • ${product.price} ₽`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.categories.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiFolder className={styles.sectionIcon} data-type="category" />,
                                                            'Категории'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.categories.map((category) => (
                                                                <Box
                                                                    key={`category-${category.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="category"
                                                                    onClick={() => handleResultClick(category)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {category.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {category.subtitle}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.suppliers.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiTruck className={styles.sectionIcon} data-type="supplier" />,
                                                            'Поставщики'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.suppliers.map((supplier) => (
                                                                <Box
                                                                    key={`supplier-${supplier.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="supplier"
                                                                    onClick={() => handleResultClick(supplier)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {supplier.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {supplier.subtitle}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}
                                            </>
                                        ) : (
                                            <Box className={styles.noResults}>
                                                <Text size="2" color="gray">
                                                    Ничего не найдено
                                                </Text>
                                            </Box>
                                        )}
                                    </Flex>
                                </ScrollArea>
                            </Card>
                        </div>
                    )}
                </div>

                <div className={styles.dbInfo}>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                            <button
                                type="button"
                                className={styles.dbButton}
                                disabled={isDbLoading}
                                aria-label="Переключение базы данных"
                            >
                                <div className={styles.dbIcon}>
                                    <FiDatabase />
                                </div>

                                <div className={styles.dbStatus}>
                                    <div
                                        className={`${styles.statusIndicator} ${dbStatus?.isRemote ? styles.online : styles.offline}`}
                                    >
                                        <div className={styles.statusDot}></div>
                                        <span>{dbStatus?.isRemote ? 'Онлайн' : 'Оффлайн'}</span>
                                    </div>
                                </div>
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content align="end">
                            {dbStatus?.isRemote ? (
                                <DropdownMenu.Item
                                    onSelect={() => switchDbMode('local')}
                                    disabled={isDbSwitching}
                                >
                                    Перейти в оффлайн базу
                                </DropdownMenu.Item>
                            ) : (
                                <DropdownMenu.Item
                                    onSelect={() => switchDbMode('remote')}
                                    disabled={isDbSwitching || !dbStatus?.remoteAvailable}
                                >
                                    Попробовать подключиться к удаленной базе
                                </DropdownMenu.Item>
                            )}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <div className={styles.profile} role="button" tabIndex={0}>
                            <div className={styles.profileMeta}>
                                <div className={styles.profileName}>{user?.employee?.fio || '—'}</div>
                                <div className={styles.profileRole}>
                                    {user?.roles?.includes('director') ? 'Директор' : 'Профиль'}
                                </div>
                            </div>
                        </div>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Content align="end" className={styles.profileMenuContent}>
                        <DropdownMenu.Item
                            onSelect={async (e) => {
                                e?.preventDefault?.();
                                if (!user?.employee?.id) return;
                                await safePush(`/managers/${user.employee.id}?mode=profile`);
                            }}
                        >
                            Профиль
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator />
                        <DropdownMenu.Sub>
                            <DropdownMenu.SubTrigger>
                                Тема
                            </DropdownMenu.SubTrigger>
                            <DropdownMenu.SubContent className={styles.profileMenuContent}>
                                <DropdownMenu.RadioGroup value={user?.preferences?.theme === 'dark' ? 'dark' : 'light'}>
                                    <DropdownMenu.RadioItem
                                        value="light"
                                        onSelect={async () => {
                                            await setTheme('light');
                                        }}
                                    >
                                        Светлая
                                    </DropdownMenu.RadioItem>
                                    <DropdownMenu.RadioItem
                                        value="dark"
                                        onSelect={async () => {
                                            await setTheme('dark');
                                        }}
                                    >
                                        Тёмная
                                    </DropdownMenu.RadioItem>
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.SubContent>
                        </DropdownMenu.Sub>

                        <DropdownMenu.Item
                            onSelect={(event) => {
                                event?.preventDefault?.();
                                setIsSystemGuideOpen(true);
                            }}
                        >
                            Подсказка по системе
                        </DropdownMenu.Item>

                        {canViewDocuments || canViewAdminFinance || canViewScheduleBoard || canViewAdminSettings || canViewAdminRbac || canViewAdminAudit || canViewAdminDataExchange ? (
                            <>
                                <DropdownMenu.Separator />
                                {canViewDocuments ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/documents');
                                        }}
                                    >
                                        Документы
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewAdminFinance ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin/finance');
                                        }}
                                    >
                                        Финансы
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewScheduleBoard ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin/schedule-board');
                                        }}
                                    >
                                        График сотрудников
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewAdminSettings ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin/settings');
                                        }}
                                    >
                                        Настройки системы
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewAdminDataExchange ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin/data-exchange');
                                        }}
                                    >
                                        Обмен данными
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewAdminRbac ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin');
                                        }}
                                    >
                                        Администрирование
                                    </DropdownMenu.Item>
                                ) : null}
                                {canViewAdminAudit ? (
                                    <DropdownMenu.Item
                                        onSelect={async (e) => {
                                            e?.preventDefault?.();
                                            await safePush('/admin/audit');
                                        }}
                                    >
                                        Аудит-лог
                                    </DropdownMenu.Item>
                                ) : null}
                            </>
                        ) : null}

                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                            onSelect={async (e) => {
                                e?.preventDefault?.();
                                await logout();
                            }}
                        >
                            Выйти
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>

            <SystemGuidePopup
                open={isSystemGuideOpen}
                steps={SYSTEM_GUIDE_STEPS}
                completed={systemGuideCompleted}
                furthestStep={systemGuideFurthestStep}
                onClose={() => setIsSystemGuideOpen(false)}
                onProgressChange={persistSystemGuideState}
            />
        </header>
    );
}
