import { setAdminSession, verifyAdminCredentials } from '../../server/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { username, password } = req.body || {};
    if (!verifyAdminCredentials(username, password)) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    setAdminSession(res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not sign in.' });
  }
}
