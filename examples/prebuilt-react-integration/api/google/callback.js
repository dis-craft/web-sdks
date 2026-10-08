import {
  exchangeGoogleCode,
  readOAuthState,
  storeGoogleTokens,
} from '../../server/googleAuth.js';

export default async function handler(req, res) {
  try {
    const { code, state, error } = req.query || {};
    if (error) throw new Error(`Google authorization failed: ${error}`);
    if (!code || !state || state !== readOAuthState(req)) {
      throw new Error('Invalid or expired Google authorization state.');
    }

    const tokens = await exchangeGoogleCode(code);
    storeGoogleTokens(res, tokens);

    res.statusCode = 302;
    res.setHeader('Location', '/admin?google=connected');
    res.end();
  } catch (error) {
    res.statusCode = 302;
    res.setHeader('Location', `/admin?google=error&message=${encodeURIComponent(error.message || 'Google authorization failed.')}`);
    res.end();
  }
}
