import { getGoogleSessionFromRequest } from '../../server/googleAuth.js';

export default async function handler(req, res) {
  const session = getGoogleSessionFromRequest(req);
  res.status(200).json({
    connected: Boolean(session?.refreshToken || session?.accessToken),
    email: session?.email || null,
  });
}
