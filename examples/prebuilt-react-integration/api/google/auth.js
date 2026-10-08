import { buildGoogleAuthUrl, createOAuthState, storeOAuthState } from '../../server/googleAuth.js';

export default async function handler(req, res) {
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
