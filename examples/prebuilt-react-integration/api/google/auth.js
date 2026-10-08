import { buildGoogleAuthUrl, createOAuthState, storeOAuthState } from '../../server/googleAuth.js';
import { requireAdmin } from '../../server/adminAuth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const state = createOAuthState();
    storeOAuthState(res, state);
    res.statusCode = 302;
    res.setHeader('Location', buildGoogleAuthUrl(state));
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not start Google authorization.' });
  }
}
