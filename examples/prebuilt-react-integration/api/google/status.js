import { getGoogleSessionFromRequest } from '../../server/googleAuth.js';
import { requireAdmin } from '../../server/adminAuth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const session = getGoogleSessionFromRequest(req);
  res.status(200).json({
    connected: Boolean(session?.refreshToken || session?.accessToken),
    email: session?.email || null,
  });
}
