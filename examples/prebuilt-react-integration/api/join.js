import { verifyJoinToken } from '../server/joinLinks.js';

export default async function handler(req, res) {
  try {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const data = verifyJoinToken(token);
    return res.status(200).json({
      className: data.c || 'Live Class',
      startsAt: data.s || null,
      durationMinutes: data.d || null,
      meetingUri: data.m,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid class link.' });
  }
}
