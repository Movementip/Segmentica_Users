import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    const actor = await requirePermission(req, res, 'purchases.create');
    if (!actor) return;

    try {
        const token = crypto.randomUUID();

        await query(
            `
              INSERT INTO app_settings (key, value, updated_at)
              VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
              ON CONFLICT (key)
              DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            `,
            [`purchase_create_token:${token}`, JSON.stringify({ type: 'purchase_create_token' })]
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error('Error creating purchase token:', error);
        res.status(500).json({ error: 'Не удалось подготовить создание закупки' });
    }
}
