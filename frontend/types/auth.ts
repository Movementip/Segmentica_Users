export type AuthEmployee = {
    id: number;
    fio: string;
    position: string | null;
};

export type AuthUser = {
    userId: number;
    employee: AuthEmployee;
    roles: string[];
    permissions: string[];
    preferences: Record<string, unknown>;
};

export type EmployeeLookupItem = AuthEmployee;
