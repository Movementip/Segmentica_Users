import { NextApiRequest, NextApiResponse } from 'next';
import { dbMode, isRemote, remoteAvailable } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Return the current database connection status
        res.status(200).json({ isRemote, mode: dbMode, remoteAvailable });
    } catch (error) {
        console.error('Error checking DB status:', error);
        res.status(500).json({ error: 'Failed to check database status' });
    }
}
