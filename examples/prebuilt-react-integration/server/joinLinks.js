import crypto from 'node:crypto';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function b64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function unb64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(payload) {
  return crypto
    .createHmac('sha256', required('JOIN_LINK_SECRET'))
    .update(payload)
    .digest('base64url');
}

export function createJoinToken(data) {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${signature(payload)}`;
}

export function verifyJoinToken(token) {
  const [payload, providedSignature] = String(token || '').split('.');
  if (!payload || !providedSignature) throw new Error('Invalid class link.');
  const expected = signature(payload);
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid class link signature.');

  const data = JSON.parse(unb64url(payload));
  if (!data.m || typeof data.m !== 'string') throw new Error('Class link has no meeting URI.');
  if (data.e && Number(data.e) < Date.now()) throw new Error('This class link has expired.');
  return data;
}
