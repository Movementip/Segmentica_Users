export interface VatRateOption {
  id: number;
  code: string;
  label: string;
  rate: number;
  isDefault?: boolean;
}

export interface VatAmounts {
  net: number;
  tax: number;
  total: number;
}

export const VAT_RATE_OPTIONS: VatRateOption[] = [
  { id: 1, code: 'without_vat', label: 'без НДС', rate: 0 },
  { id: 2, code: 'vat_5', label: '5%', rate: 5 },
  { id: 3, code: 'vat_7', label: '7%', rate: 7 },
  { id: 4, code: 'vat_10', label: '10%', rate: 10 },
  { id: 5, code: 'vat_22', label: '22%', rate: 22, isDefault: true },
];

export const DEFAULT_VAT_RATE_ID = VAT_RATE_OPTIONS.find((option) => option.isDefault)?.id ?? 5;

export const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export const isValidVatRateId = (value: unknown) => {
  const id = Number(value);
  return VAT_RATE_OPTIONS.some((option) => option.id === id);
};

export const normalizeVatRateId = (value: unknown) => {
  const id = Number(value);
  return isValidVatRateId(id) ? id : DEFAULT_VAT_RATE_ID;
};

export const getVatRateOption = (value: unknown): VatRateOption => {
  const normalizedId = normalizeVatRateId(value);
  return VAT_RATE_OPTIONS.find((option) => option.id === normalizedId) ?? VAT_RATE_OPTIONS[VAT_RATE_OPTIONS.length - 1];
};

export const fetchDefaultVatRateId = async (): Promise<number> => {
  try {
    const response = await fetch('/api/settings/vat');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return DEFAULT_VAT_RATE_ID;
    return normalizeVatRateId((data as any)?.defaultVatRateId);
  } catch {
    return DEFAULT_VAT_RATE_ID;
  }
};

export const calculateVatAmountsFromGross = (grossAmount: number, vatRate: number): VatAmounts => {
  const total = roundMoney(grossAmount);
  const rate = Number(vatRate) || 0;

  if (rate <= 0) {
    return {
      net: total,
      tax: 0,
      total,
    };
  }

  const net = roundMoney(total / (1 + rate / 100));
  const tax = roundMoney(total - net);

  return {
    net,
    tax,
    total,
  };
};

export const calculateVatAmountsFromNet = (netAmount: number, vatRate: number): VatAmounts => {
  const net = roundMoney(netAmount);
  const rate = Number(vatRate) || 0;
  const tax = rate <= 0 ? 0 : roundMoney(net * (rate / 100));
  const total = roundMoney(net + tax);

  return {
    net,
    tax,
    total,
  };
};

export const calculateVatAmountsFromLine = (quantity: number, price: number, vatRate: number): VatAmounts => {
  const netAmount = roundMoney((Number(quantity) || 0) * (Number(price) || 0));
  return calculateVatAmountsFromNet(netAmount, vatRate);
};
