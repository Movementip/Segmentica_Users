import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabaseStatusSnapshot } from '../../lib/databaseStatus';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const snapshot = await getDatabaseStatusSnapshot();
        res.status(200).json(snapshot);
    } catch (error) {
        console.error('Error checking DB status:', error);
        res.status(500).json({ error: 'Failed to check database status' });
    }
}
