import { isAdmin } from '../../server/adminAuth.js';

export default async function handler(req, res) {
  return res.status(200).json({ authenticated: isAdmin(req) });
}
