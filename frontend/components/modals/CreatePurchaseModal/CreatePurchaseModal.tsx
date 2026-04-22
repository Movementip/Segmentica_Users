import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import styles from '../CreatePurchaseModal/CreatePurchaseModal.module.css';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, fetchDefaultVatRateId, getVatRateOption, VAT_RATE_OPTIONS } from '../../../lib/vat';
import { EntityModalShell } from '../../EntityModalShell/EntityModalShell';
import OrderSearchSelect from '../../ui/OrderSearchSelect/OrderSearchSelect';
import { Checkbox } from '../../ui/checkbox';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Box, Flex, Text } from '../OrderModalPrimitives/OrderModalPrimitives';

interface Product {
    id: number;
    название: string;
    артикул: string;
    единица_измерения: string;
    цена?: number;
    цена_продажи?: number;
}

interface Supplier {
    id: number;
    название: string;
}

interface SupplierRecommendationLine {
    товар_id: number;
    цена: number;
    срок_поставки: number;
}

interface SupplierRecommendation {
    supplierId: number;
    supplierName: string;
    matchedCount: number;
    totalRequested: number;
    fullyMatches: boolean;
    missingProductIds: number[];
    totalPrice: number | null;
    maxLeadTimeDays: number | null;
    positions: SupplierRecommendationLine[];
}

interface SupplierCatalogItem extends SupplierRecommendationLine {
    название: string;
    артикул: string;
    единица_измерения: string;
    категория?: string;
}

interface TransportOption {
    id: number;
    название: string;
}

interface OrderOption {
    id: number;
    клиент_название?: string;
}

type SupplierRecommendationResponse = {
    error?: string;
    settings?: {
        useSupplierAssortment?: boolean;
        useSupplierLeadTime?: boolean;
    };
    recommendations?: SupplierRecommendation[];
    selectedSupplierAssortment?: Record<string, SupplierRecommendationLine>;
    selectedSupplierCatalog?: SupplierCatalogItem[];
};

type TransportApiItem = {
    id?: number;
    название?: string;
};

type TransportApiResponse = TransportApiItem[] | { transport?: TransportApiItem[] };

type OrderApiItem = {
    id?: number;
    клиент_название?: string;
};

type CreateTokenResponse = {
    token?: string;
    error?: string;
};

interface PurchasePosition {
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number;
    включена: boolean;
}

export interface OrderPositionSnapshot {
    товар_id: number;
    количество: number;
    ндс_id?: number;
    цена?: number;
}

const normalizeOrderPositionSnapshot = (
    snapshot: OrderPositionSnapshot,
    vatRateId: number
): PurchasePosition => {
    const productId = Number(snapshot.товар_id) || 0;
    const quantity = Number(snapshot.количество) || 1;
    const price = Number(snapshot.цена ?? 0) || 0;
    const rawVatId = snapshot.ндс_id;

    return {
        товар_id: productId,
        количество: quantity > 0 ? quantity : 1,
        цена: price,
        ндс_id: rawVatId == null ? vatRateId : Number(rawVatId) || vatRateId,
        включена: true,
    };
};

interface CreatePurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseCreated: () => void;
    поставщик_id?: number;
    поставщик_название?: string;
    заявка_id?: number;
    lockOrderId?: boolean;
    initialOrderPositions?: OrderPositionSnapshot[];
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
    isOpen,
    onClose,
    onPurchaseCreated,
    поставщик_id = 0,
    поставщик_название = '',
    заявка_id,
    lockOrderId = false,
    initialOrderPositions
}) => {
    const submitLockRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transports, setTransports] = useState<TransportOption[]>([]);
    const [orders, setOrders] = useState<OrderOption[]>([]);
    const [createToken, setCreateToken] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number>(поставщик_id);
    const [selectedOrderId, setSelectedOrderId] = useState<number>(заявка_id || 0);
    const [формаДанные, setФормаДанные] = useState({
        статус: 'заказано',
        дата_поступления: '',
        использовать_доставку: false,
        транспорт_id: 0,
        стоимость_доставки: '',
    });
    const [позиции, setПозиции] = useState<PurchasePosition[]>([
        { товар_id: 0, количество: 1, цена: 0, ндс_id: DEFAULT_VAT_RATE_ID, включена: true }
    ]);
    const [defaultVatRateId, setDefaultVatRateId] = useState(DEFAULT_VAT_RATE_ID);
    const [useSupplierAssortment, setUseSupplierAssortment] = useState(false);
    const [useSupplierLeadTime, setUseSupplierLeadTime] = useState(false);
    const [supplierConstraintsLoaded, setSupplierConstraintsLoaded] = useState(false);
    const [supplierRecommendations, setSupplierRecommendations] = useState<SupplierRecommendation[]>([]);
    const [selectedSupplierAssortment, setSelectedSupplierAssortment] = useState<Record<number, SupplierRecommendationLine>>({});
    const [selectedSupplierCatalog, setSelectedSupplierCatalog] = useState<SupplierCatalogItem[]>([]);
    const [supplierRecommendationError, setSupplierRecommendationError] = useState<string | null>(null);
    const getProductSalePrice = (product?: Product | null) => Number(product?.цена_продажи ?? product?.цена ?? 0);
    const handleClose = () => {
        submitLockRef.current = false;
        onClose();
    };

    const buildSuggestedArrivalDateValue = (leadDays: number) => {
        const date = new Date();
        date.setDate(date.getDate() + Math.max(0, Number(leadDays) || 0));
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const buildInitialPositions = useCallback((vatRateId: number): PurchasePosition[] => {
        if (!initialOrderPositions || initialOrderPositions.length === 0) {
            return [{ товар_id: 0, количество: 1, цена: 0, ндс_id: vatRateId, включена: true }];
        }

        return initialOrderPositions.map((snapshot) => normalizeOrderPositionSnapshot(snapshot, vatRateId));
    }, [initialOrderPositions]);

    const resetModalState = useCallback((vatRateId: number) => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        const pad = (n: number) => String(n).padStart(2, '0');
        const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

        setError(null);
        setSupplierRecommendationError(null);
        setCreateToken('');
        setSelectedSupplierId(Number(поставщик_id) || 0);
        setUseSupplierAssortment(false);
        setUseSupplierLeadTime(false);
        setSupplierConstraintsLoaded(false);
        setSupplierRecommendations([]);
        setSelectedSupplierAssortment({});
        setSelectedSupplierCatalog([]);
        setSelectedOrderId(Number(заявка_id) || 0);
        setФормаДанные({
            статус: 'заказано',
            дата_поступления: value,
            использовать_доставку: false,
            транспорт_id: 0,
            стоимость_доставки: '',
        });
        setПозиции(buildInitialPositions(vatRateId));
    }, [buildInitialPositions, поставщик_id, заявка_id]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!createToken) return false;
        if (!selectedSupplierId) return false;
        if (формаДанные.использовать_доставку && !формаДанные.транспорт_id) return false;

        const validPositions = позиции.filter((pos) => pos.включена && pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0);
        if (validPositions.length === 0) return false;

        if (useSupplierAssortment) {
            const hasMissingAssortmentPositions = validPositions.some((position) => !selectedSupplierAssortment[position.товар_id]);
            if (hasMissingAssortmentPositions) return false;
        }

        return true;
    }, [createToken, loading, selectedSupplierId, формаДанные.использовать_доставку, формаДанные.транспорт_id, позиции, useSupplierAssortment, selectedSupplierAssortment]);

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);
    const assortmentRelevantPositions = useMemo(
        () => позиции.filter((position) => position.включена && position.товар_id > 0 && position.количество > 0),
        [позиции]
    );
    const selectedSupplierRecommendation = useMemo(
        () => supplierRecommendations.find((item) => item.supplierId === selectedSupplierId) || null,
        [selectedSupplierId, supplierRecommendations]
    );
    const recommendedSupplier = useMemo(
        () => supplierRecommendations.find((item) => item.fullyMatches) || supplierRecommendations[0] || null,
        [supplierRecommendations]
    );
    const missingAssortmentProductIds = useMemo(
        () => assortmentRelevantPositions
            .map((item) => item.товар_id)
            .filter((productId) => useSupplierAssortment && !selectedSupplierAssortment[productId]),
        [assortmentRelevantPositions, selectedSupplierAssortment, useSupplierAssortment]
    );
    const supplierOptions = useMemo(() => {
        const recommendationById = new Map<number, SupplierRecommendation>(
            supplierRecommendations.map((item) => [item.supplierId, item])
        );

        return [...suppliers]
            .sort((left, right) => {
                const leftIndex = supplierRecommendations.findIndex((item) => item.supplierId === left.id);
                const rightIndex = supplierRecommendations.findIndex((item) => item.supplierId === right.id);
                if (leftIndex === -1 && rightIndex === -1) {
                    return left.название.localeCompare(right.название, 'ru-RU');
                }
                if (leftIndex === -1) return 1;
                if (rightIndex === -1) return -1;
                return leftIndex - rightIndex;
            })
            .map((supplier) => {
                const recommendation = recommendationById.get(supplier.id);
                if (!recommendation || !useSupplierAssortment || assortmentRelevantPositions.length === 0) {
                    return { value: String(supplier.id), label: supplier.название };
                }

                return {
                    value: String(supplier.id),
                    label: supplier.название,
                };
            });
    }, [assortmentRelevantPositions.length, supplierRecommendations, suppliers, useSupplierAssortment]);
    const orderOptions = useMemo(
        () => orders.map((order) => ({
            value: String(order.id),
            label: `#${order.id}${order.клиент_название ? ` — ${order.клиент_название}` : ''}`,
        })),
        [orders]
    );
    const purchaseOrderOptions = useMemo(
        () => [{ value: '', label: 'Без заявки' }, ...orderOptions],
        [orderOptions]
    );
    const transportOptions = useMemo(
        () => transports.map((transport) => ({ value: String(transport.id), label: transport.название })),
        [transports]
    );
    const productOptions = useMemo(() => {
        if (!supplierConstraintsLoaded) {
            return selectedSupplierId > 0 ? [] : products.map((product) => ({
                value: String(product.id),
                label: `${product.артикул ? `${product.артикул} - ` : ''}${product.название}`,
            }));
        }

        if (!useSupplierAssortment) {
            return products.map((product) => ({
                value: String(product.id),
                label: `${product.артикул ? `${product.артикул} - ` : ''}${product.название}`,
            }));
        }

        if (selectedSupplierId <= 0) {
            return [];
        }

        const catalogById = new Map<number, SupplierCatalogItem>(
            selectedSupplierCatalog.map((item) => [item.товар_id, item])
        );
        const selectedProductIds = Array.from(new Set(позиции.map((position) => Number(position.товар_id) || 0).filter((id) => id > 0)));

        for (const productId of selectedProductIds) {
            if (catalogById.has(productId)) continue;
            const product = productsById.get(productId);
            if (!product) continue;
            catalogById.set(productId, {
                товар_id: productId,
                название: product.название,
                артикул: product.артикул,
                единица_измерения: product.единица_измерения || 'шт',
                категория: undefined,
                цена: Number(product.цена ?? product.цена_продажи ?? 0) || 0,
                срок_поставки: 0,
            });
        }

        return Array.from(catalogById.values()).map((product) => ({
            value: String(product.товар_id),
            label: `${product.артикул ? `${product.артикул} - ` : ''}${product.название}`,
        }));
    }, [products, productsById, позиции, selectedSupplierCatalog, selectedSupplierId, supplierConstraintsLoaded, useSupplierAssortment]);

    const datePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(0, 10) : '';
    const timePart = формаДанные.дата_поступления ? формаДанные.дата_поступления.slice(11, 16) : '';

    useEffect(() => {
        if (!isOpen) {
            submitLockRef.current = false;
            return;
        }

        const nextVatRateId = defaultVatRateId || DEFAULT_VAT_RATE_ID;
        resetModalState(nextVatRateId);
        fetchProducts();
        fetchSuppliers();
        void fetchOrders();
        void fetchTransports();
        void fetchCreateToken();
        void fetchDefaultVatRateId().then((value) => {
            setDefaultVatRateId(value);
            setПозиции((prev) => prev.map((item) => ({
                ...item,
                ндс_id: item.ндс_id || value,
            })));
        });
    }, [defaultVatRateId, initialOrderPositions, isOpen, поставщик_id, поставщик_название, resetModalState]);

    useEffect(() => {
        if (!isOpen) return;
        if (products.length === 0) return;

        setПозиции((prev) => prev.map((item) => {
            if (!item.товар_id || Number(item.цена) > 0) return item;
            const product = productsById.get(item.товар_id);
            const price = getProductSalePrice(product);
            if (price <= 0) return item;
            return {
                ...item,
                цена: price,
            };
        }));
    }, [isOpen, products, productsById]);

    useEffect(() => {
        if (!isOpen) return;

        const timeoutId = window.setTimeout(async () => {
            try {
                setSupplierRecommendationError(null);
                const response = await fetch('/api/purchases/supplier-recommendations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        supplierId: selectedSupplierId,
                        positions: assortmentRelevantPositions,
                    }),
                });
                const data: SupplierRecommendationResponse = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || 'Не удалось загрузить рекомендации по поставщикам');
                }

                const nextUseSupplierAssortment = Boolean(data.settings?.useSupplierAssortment);
                const nextUseSupplierLeadTime = Boolean(data.settings?.useSupplierLeadTime);
                const nextRecommendations = Array.isArray(data.recommendations)
                    ? data.recommendations
                    : [];
                const nextSelectedAssortment = Object.fromEntries(
                    Object.entries(data.selectedSupplierAssortment || {}).map(([key, value]) => [Number(key), value])
                ) as Record<number, SupplierRecommendationLine>;
                const nextSelectedSupplierCatalog = Array.isArray(data.selectedSupplierCatalog)
                    ? data.selectedSupplierCatalog
                    : [];

                setUseSupplierAssortment(nextUseSupplierAssortment);
                setUseSupplierLeadTime(nextUseSupplierLeadTime);
                setSupplierConstraintsLoaded(true);
                setSupplierRecommendations(nextRecommendations);
                setSelectedSupplierAssortment(nextSelectedAssortment);
                setSelectedSupplierCatalog(nextSelectedSupplierCatalog);

                if (nextUseSupplierAssortment && !selectedSupplierId && nextRecommendations.length > 0) {
                    const bestMatch = nextRecommendations.find((item) => item.fullyMatches) || nextRecommendations[0];
                    if (bestMatch) {
                        setSelectedSupplierId(bestMatch.supplierId);
                    }
                }
            } catch (recommendationError) {
                console.error('Error fetching supplier recommendations:', recommendationError);
                setSupplierRecommendationError(recommendationError instanceof Error ? recommendationError.message : 'Не удалось загрузить рекомендации по поставщикам');
                setSupplierConstraintsLoaded(true);
                setSupplierRecommendations([]);
                setSelectedSupplierAssortment({});
                setSelectedSupplierCatalog([]);
            }
        }, 180);

        return () => window.clearTimeout(timeoutId);
    }, [assortmentRelevantPositions, isOpen, selectedSupplierId]);

    useEffect(() => {
        if (!isOpen) return;
        if (!useSupplierAssortment) return;
        if (selectedSupplierId <= 0) return;
        if (Object.keys(selectedSupplierAssortment).length === 0) return;

        setПозиции((prev) => prev.map((item) => {
            const assortmentItem = selectedSupplierAssortment[item.товар_id];
            if (!assortmentItem) return item;
            if (Number(item.цена) === assortmentItem.цена) return item;
            return {
                ...item,
                цена: assortmentItem.цена,
            };
        }));
    }, [isOpen, selectedSupplierAssortment, selectedSupplierId, useSupplierAssortment]);

    useEffect(() => {
        if (!isOpen) return;
        if (!useSupplierLeadTime) return;
        if (!selectedSupplierRecommendation?.maxLeadTimeDays) return;

        const suggestedDate = buildSuggestedArrivalDateValue(selectedSupplierRecommendation.maxLeadTimeDays);
        setФормаДанные((prev) => {
            if (prev.дата_поступления === suggestedDate) {
                return prev;
            }
            return {
                ...prev,
                дата_поступления: suggestedDate,
            };
        });
    }, [isOpen, selectedSupplierRecommendation, useSupplierLeadTime]);

    const fetchProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/suppliers');
            if (response.ok) {
                const data = await response.json();
                setSuppliers(data);
                setSelectedSupplierId((prev) => (
                    prev && data.some((supplier: Supplier) => supplier.id === prev) ? prev : 0
                ));
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/orders');
            const data = await response.json().catch(() => []);
            const list = Array.isArray(data) ? data : [];
            setOrders(
                list
                    .map((item: OrderApiItem) => ({
                        id: Number(item?.id),
                        клиент_название: String(item?.клиент_название || ''),
                    }))
                    .filter((item: OrderOption) => Number.isFinite(item.id) && item.id > 0)
            );
        } catch (fetchOrdersError) {
            console.error('Error fetching orders:', fetchOrdersError);
            setOrders([]);
        }
    };

    const fetchCreateToken = async () => {
        try {
            const response = await fetch('/api/purchases/create-token');
            const data: CreateTokenResponse = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось подготовить создание закупки');
            }

            setCreateToken(String(data?.token || ''));
        } catch (tokenError) {
            console.error('Error fetching purchase create token:', tokenError);
            setCreateToken('');
            setError(tokenError instanceof Error ? tokenError.message : 'Не удалось подготовить создание закупки');
        }
    };

    const fetchTransports = async () => {
        try {
            const response = await fetch('/api/transport');
            const data: TransportApiResponse = await response.json().catch(() => []);
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.transport)
                    ? data.transport
                    : [];
            setTransports(
                list
                    .map((item: TransportApiItem) => ({ id: Number(item?.id), название: String(item?.название || '') }))
                    .filter((item: TransportOption) => Number.isFinite(item.id) && item.id > 0)
            );
        } catch (transportError) {
            console.error('Error fetching transports:', transportError);
            setTransports([]);
        }
    };

    const handlePositionChange = (index: number, field: keyof PurchasePosition, value: string | number | boolean) => {
        const newPositions = [...позиции];
        const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        newPositions[index] = {
            ...newPositions[index],
            [field]: parsedValue
        };
        if (field === 'товар_id') {
            const assortmentItem = selectedSupplierCatalog.find((item) => item.товар_id === Number(parsedValue));
            if (useSupplierAssortment && assortmentItem) {
                newPositions[index].цена = assortmentItem.цена;
            } else {
                const product = products.find((item) => item.id === Number(parsedValue));
                if (product) {
                    newPositions[index].цена = getProductSalePrice(product);
                }
            }
        }
        setПозиции(newPositions);
    };

    const addPosition = () => {
        setПозиции([...позиции, { товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId, включена: true }]);
    };

    const removePosition = (index: number) => {
        if (позиции.length > 1) {
            setПозиции(позиции.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current) return;
        submitLockRef.current = true;
        setLoading(true);
        setError(null);

        try {
            // Validate positions
            const validPositions = позиции
                .filter(pos => pos.включена && pos.товар_id > 0 && pos.количество > 0 && pos.цена > 0)
                .map((position) => ({
                    товар_id: position.товар_id,
                    количество: position.количество,
                    цена: position.цена,
                    ндс_id: position.ндс_id,
                }));

            if (validPositions.length === 0) {
                throw new Error('Добавьте хотя бы одну позицию с корректными данными');
            }

            if (формаДанные.использовать_доставку && !формаДанные.транспорт_id) {
                throw new Error('Выберите транспортную компанию для доставки закупки');
            }

            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-purchase-create-source': 'manual-modal',
                },
                body: JSON.stringify({
                    create_token: createToken,
                    поставщик_id: selectedSupplierId,
                    заявка_id: selectedOrderId || null,
                    статус: формаДанные.статус,
                    дата_поступления: формаДанные.дата_поступления || null,
                    использовать_доставку: формаДанные.использовать_доставку,
                    транспорт_id: формаДанные.использовать_доставку ? Number(формаДанные.транспорт_id) : null,
                    стоимость_доставки: формаДанные.использовать_доставку && формаДанные.стоимость_доставки.trim()
                        ? Number(формаДанные.стоимость_доставки)
                        : null,
                    позиции: validPositions
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания закупки');
            }

            onPurchaseCreated();
            onClose();
            // Reset form
            setФормаДанные({ статус: 'заказано', дата_поступления: '', использовать_доставку: false, транспорт_id: 0, стоимость_доставки: '' });
            setПозиции([{ товар_id: 0, количество: 1, цена: 0, ндс_id: defaultVatRateId, включена: true }]);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            submitLockRef.current = false;
            setLoading(false);
        }
    };

    const getTotalAmount = () => {
        return позиции.filter((pos) => pos.включена).reduce((sum, pos) => (
            sum + calculateVatAmountsFromLine(pos.количество, pos.цена, getVatRateOption(pos.ндс_id).rate).total
        ), 0);
    };

    const deliveryAmount = формаДанные.использовать_доставку
        ? Number(формаДанные.стоимость_доставки || 0)
        : 0;
    const grandTotalAmount = getTotalAmount() + deliveryAmount;

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
            <EntityModalShell
                className={styles.modalContent}
                onClose={handleClose}
                title="Создать закупку"
                description="Укажи поставщика, состав закупки и параметры поступления."
            >
                <form onSubmit={handleSubmit} className={styles.form}>
                    <Flex direction="column" gap="4">
                        {error ? (
                            <Box className={styles.error}>
                                <Text size="2">{error}</Text>
                            </Box>
                        ) : null}

                        <div className={styles.formGrid}>
                            <Box className={styles.formGroup}>
                                <OrderSearchSelect
                                    label="Поставщик"
                                    value={selectedSupplierId ? String(selectedSupplierId) : ''}
                                    onValueChange={(value) => {
                                        const id = value ? Number(value) : 0;
                                        setSelectedSupplierId(id);
                                    }}
                                    options={supplierOptions}
                                    placeholder={поставщик_название ? `Поиск поставщика (${поставщик_название})` : 'Поиск поставщика'}
                                />
                                {useSupplierAssortment && assortmentRelevantPositions.length > 0 ? (
                                    <Text as="span" size="1" color={missingAssortmentProductIds.length > 0 ? 'red' : 'gray'}>
                                        {selectedSupplierRecommendation
                                            ? selectedSupplierRecommendation.fullyMatches
                                                ? `Поставщик покрывает ${selectedSupplierRecommendation.matchedCount}/${selectedSupplierRecommendation.totalRequested} позиций${selectedSupplierRecommendation.totalPrice != null ? `, сумма по ассортименту ${selectedSupplierRecommendation.totalPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}` : ''}${useSupplierLeadTime && selectedSupplierRecommendation.maxLeadTimeDays != null ? `, срок до ${selectedSupplierRecommendation.maxLeadTimeDays} дн.` : ''}.`
                                                : `У выбранного поставщика в ассортименте только ${selectedSupplierRecommendation.matchedCount}/${selectedSupplierRecommendation.totalRequested} позиций. Остальные позиции нужно оставить на потом или оформить другой закупкой.`
                                            : recommendedSupplier
                                                ? `Лучший вариант сейчас: ${recommendedSupplier.supplierName}${recommendedSupplier.totalPrice != null ? `, ${recommendedSupplier.totalPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}` : ''}${useSupplierLeadTime && recommendedSupplier.maxLeadTimeDays != null ? `, до ${recommendedSupplier.maxLeadTimeDays} дн.` : ''}.`
                                                : 'По выбранным позициям пока нет подходящих записей в ассортименте поставщиков.'}
                                    </Text>
                                ) : null}
                                {supplierRecommendationError ? (
                                    <Text as="span" size="1" color="red">
                                        {supplierRecommendationError}
                                    </Text>
                                ) : null}
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Статус закупки</Text>
                                <Select value={формаДанные.статус} onValueChange={(value) => setФормаДанные((p) => ({ ...p, статус: String(value) }))}>
                                    <SelectTrigger className={styles.selectTrigger}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="заказано">Заказано</SelectItem>
                                        <SelectItem value="в пути">В пути</SelectItem>
                                        <SelectItem value="получено">Получено</SelectItem>
                                        <SelectItem value="отменено">Отменено</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Заявка</Text>
                                {lockOrderId ? (
                                    <Input
                                        value={
                                            selectedOrderId
                                                ? `#${selectedOrderId}${orders.find((item) => item.id === selectedOrderId)?.клиент_название ? ` — ${orders.find((item) => item.id === selectedOrderId)?.клиент_название}` : ''}`
                                                : ''
                                        }
                                        readOnly
                                        className={styles.textField}
                                    />
                                ) : (
                                    <OrderSearchSelect
                                        value={selectedOrderId ? String(selectedOrderId) : ''}
                                        onValueChange={(value) => setSelectedOrderId(value ? Number(value) || 0 : 0)}
                                        options={purchaseOrderOptions}
                                        placeholder="Без заявки"
                                    />
                                )}
                                {!selectedOrderId ? (
                                    <Text as="span" size="1" color="gray">
                                        Если заявку не выбирать, закупка будет оформлена как поступление сразу на склад.
                                    </Text>
                                ) : null}
                            </Box>

                            <Box className={styles.formGroup}>
                                <Text as="label" size="2" weight="medium">Дата поступления (опционально)</Text>
                                <Flex gap="2" wrap="wrap">
                                    <Input
                                        type="date"
                                        value={datePart}
                                        onChange={(e) => {
                                            const nextDate = e.target.value;
                                            const nextTime = timePart || '00:00';
                                            setФормаДанные((p) => ({ ...p, дата_поступления: nextDate ? `${nextDate}T${nextTime}` : '' }));
                                        }}
                                        className={`${styles.textField} ${styles.dateField}`}
                                    />

                                </Flex>
                                {useSupplierLeadTime && selectedSupplierRecommendation?.maxLeadTimeDays != null ? (
                                    <Text as="span" size="1" color="gray">
                                        Дата поступления рассчитывается по самому долгому сроку среди включённых позиций: {selectedSupplierRecommendation.maxLeadTimeDays} дн.
                                    </Text>
                                ) : null}
                            </Box>

                            <Box className={styles.formGroup}>
                                <label className={styles.checkboxRow}>
                                    <Checkbox
                                        checked={формаДанные.использовать_доставку}
                                        onCheckedChange={(checked) => setФормаДанные((p) => ({
                                            ...p,
                                            использовать_доставку: checked === true,
                                            транспорт_id: checked === true ? p.транспорт_id : 0,
                                            стоимость_доставки: checked === true ? p.стоимость_доставки : '',
                                        }))}
                                        className={styles.includeCheckbox}
                                    />
                                    <span className={styles.checkboxText}>Использовать доставку</span>
                                </label>
                                <Text as="span" size="1" color="gray">
                                    Если выключено, считаем, что закупку забрали сами.
                                </Text>
                            </Box>

                            {формаДанные.использовать_доставку ? (
                                <>
                                    <Box className={styles.formGroup}>
                                        <OrderSearchSelect
                                            label="Кто доставляет"
                                            value={формаДанные.транспорт_id ? String(формаДанные.транспорт_id) : ''}
                                            onValueChange={(value) => setФормаДанные((p) => ({ ...p, транспорт_id: value ? Number(value) : 0 }))}
                                            options={transportOptions}
                                            placeholder="Выберите ТК"
                                        />
                                    </Box>

                                    <Box className={styles.formGroup}>
                                        <Text as="label" size="2" weight="medium">Стоимость доставки (опционально)</Text>
                                        <Input
                                            value={формаДанные.стоимость_доставки}
                                            onChange={(e) => setФормаДанные((p) => ({ ...p, стоимость_доставки: e.target.value }))}
                                            placeholder="400.00"
                                            className={styles.textField}
                                        />
                                    </Box>
                                </>
                            ) : null}
                        </div>

                        <Box className={styles.positionsSection}>
                            <Flex align="center" justify="between" mb="3" className={styles.positionsHeader}>
                                <Text as="span" weight="medium" className={styles.positionsTitle}>Позиции закупки</Text>
                                <Flex gap="2" wrap="wrap" justify="end">
                                    {initialOrderPositions && initialOrderPositions.length > 0 ? (
                                        <>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setПозиции((prev) => prev.map((item) => ({ ...item, включена: true })))}
                                            >
                                                Выбрать все
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setПозиции((prev) => prev.map((item) => ({ ...item, включена: false })))}
                                            >
                                                Оставить на потом
                                            </Button>
                                        </>
                                    ) : null}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={addPosition}
                                    >
                                        Добавить позицию
                                    </Button>
                                </Flex>
                            </Flex>

                            <Box className={styles.positionsTable}>
                                {позиции.length > 0 && (
                                    <Box className={styles.positionHeaderRow}>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellCenter}`}>В закупку</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Товар</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Ед.изм</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Кол-во</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>Цена, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Сумма без НДС, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={styles.positionHeaderCell}>НДС</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Сумма НДС, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellRight}`}>Всего, ₽</Text>
                                        <Text as="span" size="1" color="gray" className={`${styles.positionHeaderCell} ${styles.positionHeaderCellCenter}`} />
                                    </Box>
                                )}

                                <Flex direction="column" gap="2" className={styles.positionsList}>
                                    {позиции.map((position, index) => {
                                        const selectedProduct = productsById.get(position.товар_id);
                                        const vatAmounts = calculateVatAmountsFromLine(position.количество, position.цена, getVatRateOption(position.ндс_id).rate);

                                        return (
                                            <Box key={index} className={`${styles.positionRow} ${!position.включена ? styles.positionRowMuted : ''}`}>
                                                <label className={styles.includeCell}>
                                                    <Checkbox
                                                        checked={position.включена}
                                                        onCheckedChange={(checked) => handlePositionChange(index, 'включена', checked === true)}
                                                        className={styles.includeCheckbox}
                                                    />
                                                    <span className={styles.includeLabel}>
                                                        {position.включена ? 'Да' : 'Позже'}
                                                    </span>
                                                </label>

                                                <OrderSearchSelect
                                                    value={position.товар_id ? String(position.товар_id) : ''}
                                                    onValueChange={(value) => handlePositionChange(index, 'товар_id', value ? Number(value) : 0)}
                                                    options={productOptions}
                                                    placeholder="Выберите товар"
                                                    compact
                                                    menuPlacement="top"
                                                    inputClassName={styles.positionSearchSelectInput}
                                                    menuClassName={styles.positionSearchSelectMenu}
                                                />

                                                <Text as="span" size="2" className={styles.unitValue}>
                                                    {selectedProduct?.единица_измерения || 'шт'}
                                                </Text>

                                                <Input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={String(position.количество)}
                                                    onChange={(e) => handlePositionChange(index, 'количество', e.target.value)}
                                                    className={styles.qtyField}
                                                />

                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={String(position.цена)}
                                                    onChange={(e) => handlePositionChange(index, 'цена', e.target.value)}
                                                    className={styles.priceField}
                                                />

                                                <Text as="span" size="2" weight="medium" className={styles.positionMetric}>
                                                    {vatAmounts.net.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Select
                                                    value={String(position.ндс_id || DEFAULT_VAT_RATE_ID)}
                                                    onValueChange={(value) => handlePositionChange(index, 'ндс_id', value ? Number(value) : defaultVatRateId)}
                                                >
                                                    <SelectTrigger className={styles.vatField}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {VAT_RATE_OPTIONS.map((option) => (
                                                            <SelectItem key={option.id} value={String(option.id)}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <Text as="span" size="2" weight="medium" className={styles.positionMetric}>
                                                    {vatAmounts.tax.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Text as="span" size="2" weight="medium" className={styles.positionTotal}>
                                                    {vatAmounts.total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                                </Text>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => removePosition(index)}
                                                    disabled={позиции.length === 1}
                                                    className={styles.removePositionButton}
                                                >
                                                    ×
                                                </Button>
                                            </Box>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            <Box className={styles.totalAmount}>
                                <Text size="2" className={styles.totalRowSecondary}>
                                    Сумма товаров:{' '}
                                    {getTotalAmount().toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                                <Text size="2" className={styles.totalRowSecondary}>
                                    Стоимость доставки:{' '}
                                    {deliveryAmount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                                <Text weight="bold" className={styles.totalRowPrimary}>
                                    Общая сумма:{' '}
                                    {grandTotalAmount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </Text>
                            </Box>
                        </Box>

                        <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={loading}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="default"
                                disabled={!canSubmit}
                            >
                                {loading ? 'Создание...' : 'Создать закупку'}
                            </Button>
                        </Flex>
                    </Flex>
                </form>
            </EntityModalShell>
        </Dialog>
    );
};
