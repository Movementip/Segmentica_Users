export type ManagerIdentityDocument = {
  id: number;
  documentType: string;
  seriesNumber: string;
  issuedBy: string;
  departmentCode: string;
  issueDate: string | null;
  validUntil: string | null;
  isPrimary: boolean;
};

export type ManagerEmploymentEvent = {
  id: number;
  eventDate: string | null;
  eventType: string;
  details: string;
  status: string;
  sentDate: string | null;
  externalUuid: string | null;
};

export type ManagerRelative = {
  id: number;
  fullName: string;
  relationType: string;
  birthDate: string | null;
  documentInfo: string;
  snils: string;
  phone: string;
  notes: string;
};

export type ManagerMilitaryDocument = {
  id: number;
  documentType: string;
  seriesNumber: string;
  issuedBy: string;
  issueDate: string | null;
  validUntil: string | null;
};

export type ManagerHrProfile = {
  employeeId: number;
  manager: {
    id: number;
    fio: string;
    position: string;
    rate: number | null;
    hireDate: string | null;
    isActive: boolean;
    createdAt: string | null;
  };
  personal: {
    lastName: string;
    firstName: string;
    middleName: string;
    gender: string;
    birthDate: string | null;
    birthPlace: string;
    maritalStatus: string;
    maritalStatusSince: string | null;
    snils: string;
    inn: string;
    taxpayerStatus: string;
    citizenshipCode: string;
    citizenshipLabel: string;
    registrationAddress: string;
    registrationDate: string | null;
    actualAddressSameAsRegistration: boolean;
    actualAddress: string;
    actualAddressSince: string | null;
    personalEmail: string;
    workEmail: string;
    primaryPhone: string;
    workPhone: string;
    educationLevel: string;
    primaryProfession: string;
    secondaryProfession: string;
    languages: string[];
    notes: string;
  };
  bank: {
    bankName: string;
    bankBik: string;
    settlementAccount: string;
    correspondentAccount: string;
    mirCardNumber: string;
    alternativeBankName: string;
    alternativeAccountNumber: string;
    notes: string;
  };
  employment: {
    positionCategory: string;
    departmentName: string;
    subdivisionName: string;
    isFlightCrew: boolean;
    isSeaCrew: boolean;
    contractType: string;
    laborBookStatus: string;
    laborBookNotes: string;
    foreignWorkPermitNote: string;
  };
  military: {
    relationToService: string;
    reserveCategory: string;
    militaryRank: string;
    unitComposition: string;
    specialtyCode: string;
    fitnessCategory: string;
    fitnessCheckedAt: string | null;
    commissariatName: string;
    commissariatManual: string;
    additionalInfo: string;
    militaryRegistrationType: string;
  };
  identityDocuments: ManagerIdentityDocument[];
  employmentEvents: ManagerEmploymentEvent[];
  relatives: ManagerRelative[];
  militaryDocuments: ManagerMilitaryDocument[];
};

const trimOrEmpty = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

export const splitFio = (fio: string | null | undefined): {
  lastName: string;
  firstName: string;
  middleName: string;
} => {
  const parts = String(fio || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    lastName: parts[0] || '',
    firstName: parts[1] || '',
    middleName: parts.slice(2).join(' '),
  };
};

export const composeFio = (lastName: string, firstName: string, middleName: string): string => {
  return [trimOrEmpty(lastName), trimOrEmpty(firstName), trimOrEmpty(middleName)]
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const createEmptyManagerHrProfile = (params: {
  employeeId: number;
  fio?: string | null;
  position?: string | null;
  rate?: number | null;
  hireDate?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  email?: string | null;
  phone?: string | null;
}): ManagerHrProfile => {
  const fioParts = splitFio(params.fio);

  return {
    employeeId: params.employeeId,
    manager: {
      id: params.employeeId,
      fio: String(params.fio || ''),
      position: String(params.position || ''),
      rate: params.rate ?? null,
      hireDate: params.hireDate ?? null,
      isActive: Boolean(params.isActive),
      createdAt: params.createdAt ?? null,
    },
    personal: {
      lastName: fioParts.lastName,
      firstName: fioParts.firstName,
      middleName: fioParts.middleName,
      gender: '',
      birthDate: null,
      birthPlace: '',
      maritalStatus: '',
      maritalStatusSince: null,
      snils: '',
      inn: '',
      taxpayerStatus: '',
      citizenshipCode: '643',
      citizenshipLabel: 'Россия',
      registrationAddress: '',
      registrationDate: null,
      actualAddressSameAsRegistration: true,
      actualAddress: '',
      actualAddressSince: null,
      personalEmail: String(params.email || ''),
      workEmail: '',
      primaryPhone: String(params.phone || ''),
      workPhone: '',
      educationLevel: '',
      primaryProfession: '',
      secondaryProfession: '',
      languages: [],
      notes: '',
    },
    bank: {
      bankName: '',
      bankBik: '',
      settlementAccount: '',
      correspondentAccount: '',
      mirCardNumber: '',
      alternativeBankName: '',
      alternativeAccountNumber: '',
      notes: '',
    },
    employment: {
      positionCategory: '',
      departmentName: '',
      subdivisionName: '',
      isFlightCrew: false,
      isSeaCrew: false,
      contractType: 'labor',
      laborBookStatus: '',
      laborBookNotes: '',
      foreignWorkPermitNote: '',
    },
    military: {
      relationToService: '',
      reserveCategory: '',
      militaryRank: '',
      unitComposition: '',
      specialtyCode: '',
      fitnessCategory: '',
      fitnessCheckedAt: null,
      commissariatName: '',
      commissariatManual: '',
      additionalInfo: '',
      militaryRegistrationType: '',
    },
    identityDocuments: [],
    employmentEvents: [],
    relatives: [],
    militaryDocuments: [],
  };
};

export const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => trimOrEmpty(item))
    .filter(Boolean);
};
