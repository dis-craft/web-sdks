import crypto from 'node:crypto';

const GOOGLE_AUTH_COOKIE = 'gmeet_google_session';
const GOOGLE_STATE_COOKIE = 'gmeet_oauth_state';

const scopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.settings',
  'https://www.googleapis.com/auth/calendar.events',
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function keyFromSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function base64url(buffer) {
  return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64url(value) {
  return Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/'), 'base64');
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(required('AUTH_COOKIE_SECRET')), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(base64url).join('.');
}

function decryptJson(value) {
  const [ivRaw, tagRaw, cipherRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !cipherRaw) throw new Error('Invalid Google session cookie');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyFromSecret(required('AUTH_COOKIE_SECRET')),
    fromBase64url(ivRaw),
  );
  decipher.setAuthTag(fromBase64url(tagRaw));
  const clear = Buffer.concat([
    decipher.update(fromBase64url(cipherRaw)),
    decipher.final(),
  ]);
  return JSON.parse(clear.toString('utf8'));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').filter(Boolean).map(part => {
      const index = part.indexOf('=');
      const name = index >= 0 ? part.slice(0, index).trim() : part.trim();
      const value = index >= 0 ? part.slice(index + 1).trim() : '';
      return [name, decodeURIComponent(value)];
    }),
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function setCookie(res, name, value, options) {
  const existing = res.getHeader('Set-Cookie');
  const cookie = serializeCookie(name, value, options);
  res.setHeader('Set-Cookie', existing ? [existing, cookie].flat() : [cookie]);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

export function createOAuthState() {
  return crypto.randomBytes(32).toString('hex');
}

export function buildGoogleAuthUrl(state) {
  const clientId = required('GOOGLE_CLIENT_ID');
  const redirectUri = required('GOOGLE_REDIRECT_URI');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function storeOAuthState(res, state) {
  setCookie(res, GOOGLE_STATE_COOKIE, state, { maxAge: 10 * 60 });
}

export function readOAuthState(req) {
  return parseCookies(req)[GOOGLE_STATE_COOKIE] || '';
}

export function storeGoogleTokens(res, tokenResponse) {
  const existing = (() => {
    try {
      return getGoogleSessionFromRequest({ headers: { cookie: res.req?.headers?.cookie || '' } }) || {};
    } catch {
      return {};
    }
  })();

  const session = {
    accessToken: tokenResponse.access_token || existing.accessToken || '',
    refreshToken: tokenResponse.refresh_token || existing.refreshToken || '',
    expiresAt: Date.now() + Math.max(0, Number(tokenResponse.expires_in || 3600) - 60) * 1000,
    email: tokenResponse.email || existing.email || null,
  };

  if (!session.accessToken) throw new Error('Google did not return an access token.');
  setCookie(res, GOOGLE_AUTH_COOKIE, encryptJson(session), { maxAge: 60 * 60 * 24 * 30 });
  clearCookie(res, GOOGLE_STATE_COOKIE);
  return session;
}

export function getGoogleSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const raw = cookies[GOOGLE_AUTH_COOKIE];
  if (!raw) return null;
  try {
    return decryptJson(raw);
  } catch {
    return null;
  }
}

async function refreshSession(req, res, session) {
  if (!session?.refreshToken) return session;
  if (session.accessToken && Number(session.expiresAt || 0) > Date.now()) return session;

  const body = new URLSearchParams({
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    refresh_token: session.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Google token refresh failed.');
  }

  const updated = {
    ...session,
    accessToken: data.access_token || session.accessToken,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600) - 60) * 1000,
  };
  setCookie(res, GOOGLE_AUTH_COOKIE, encryptJson(updated), { maxAge: 60 * 60 * 24 * 30 });
  return updated;
}

export async function getGoogleAccessToken(req, res) {
  const session = getGoogleSessionFromRequest(req);
  if (!session) throw new Error('Google is not connected. Connect the academy Google account first.');
  const refreshed = await refreshSession(req, res, session);
  if (!refreshed?.accessToken) throw new Error('Google session has no access token.');
  return refreshed.accessToken;
}

export async function exchangeGoogleCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    redirect_uri: required('GOOGLE_REDIRECT_URI'),
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Google OAuth token exchange failed.');
  }

  let email = null;
  if (data.id_token) {
    try {
      const [, payload] = data.id_token.split('.');
      const decoded = JSON.parse(fromBase64url(payload).toString('utf8'));
      email = decoded.email || null;
    } catch {
      // Email is optional for the app; token creation can still proceed.
    }
  }

  return { ...data, email };
}

export const GOOGLE_AUTH_COOKIE_NAME = GOOGLE_AUTH_COOKIE;
