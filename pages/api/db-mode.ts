import { NextApiRequest, NextApiResponse } from 'next';
import { setDbMode, type DbMode, dbMode, isRemote, remoteAvailable } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode } = req.body as { mode?: DbMode };

  if (mode !== 'local' && mode !== 'remote') {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  try {
    await setDbMode(mode);
    return res.status(200).json({ ok: true, mode: dbMode, isRemote, remoteAvailable });
  } catch (error) {
    console.error('Error switching DB mode:', error);
    return res.status(500).json({ error: 'Failed to switch DB mode' });
  }
}
