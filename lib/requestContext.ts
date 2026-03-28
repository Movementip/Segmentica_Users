import { AsyncLocalStorage } from 'async_hooks';
import type { NextApiRequest } from 'next';
import type { AuthUser } from './auth';

type RequestContextStore = {
    req: NextApiRequest;
    actor: AuthUser | null;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export const enterRequestContext = (req: NextApiRequest, actor: AuthUser | null) => {
    const existing = storage.getStore();
    if (existing) {
        existing.req = req;
        existing.actor = actor;
        return;
    }
    storage.enterWith({ req, actor });
};

export const setRequestActor = (actor: AuthUser | null) => {
    const existing = storage.getStore();
    if (existing) {
        existing.actor = actor;
    }
};

export const getRequestContext = (): RequestContextStore | null => {
    return storage.getStore() || null;
};
