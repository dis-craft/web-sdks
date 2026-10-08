import { clearAdminSession } from '../../server/adminAuth.js';

export default async function handler(req, res) {
  clearAdminSession(res);
  return res.status(200).json({ ok: true });
}
