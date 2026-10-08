import crypto from 'node:crypto';

const COOKIE_NAME = 'academy_admin_session';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function key() {
  return crypto.createHash('sha256').update(required('AUTH_COOKIE_SECRET')).digest();
}

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(item => item.toString('base64url')).join('.');
}

function decrypt(value) {
  const [ivRaw, tagRaw, cipherRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !cipherRaw) throw new Error('Invalid admin session.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(cipherRaw, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(clear.toString('utf8'));
}

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        return [
          part.slice(0, index).trim(),
          decodeURIComponent(part.slice(index + 1).trim()),
        ];
      }),
  );
}

function setCookie(res, value, maxAge = 60 * 60 * 24 * 7) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ]);
}

export function setAdminSession(res) {
  setCookie(res, encrypt({ ok: true, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
}

export function clearAdminSession(res) {
  setCookie(res, '', 0);
}

export function isAdmin(req) {
  const raw = cookies(req)[COOKIE_NAME];
  if (!raw) return false;
  try {
    const session = decrypt(raw);
    return Boolean(session?.ok && Number(session.exp) > Date.now());
  } catch {
    return false;
  }
}

export function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return false;
  }
  return true;
}

export function verifyAdminCredentials(username, password) {
  return (
    String(username || '') === required('ADMIN_USERNAME') &&
    String(password || '') === required('ADMIN_PASSWORD')
  );
}
