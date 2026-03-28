import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { clearSessionCookie, getSessionIdFromRequest } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const sid = getSessionIdFromRequest(req);
    if (sid) {
        try {
            await query(`UPDATE public.sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [sid]);
        } catch (e) {
            console.error(e);
        }
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
}
