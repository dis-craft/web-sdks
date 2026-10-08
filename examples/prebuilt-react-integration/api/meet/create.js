import { getGoogleAccessToken } from '../../server/googleAuth.js';
import { createJoinToken } from '../../server/joinLinks.js';
import { sendWhatsAppClassInvite } from '../../server/whatsapp.js';

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function formatStartsAt(value) {
  if (!value) return 'Your scheduled class time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  }).format(date);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const body = req.body || {};
    const className = cleanString(body.className);
    const startsAt = cleanString(body.startsAt);
    const durationMinutes = Number(body.durationMinutes || 60);
    const autoRecord = Boolean(body.autoRecord);
    const recipients = Array.isArray(body.whatsappNumbers)
      ? body.whatsappNumbers.map(cleanString).filter(Boolean).slice(0, 200)
      : [];

    if (!className) return res.status(400).json({ error: 'Class name is required.' });
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return res.status(400).json({ error: 'Duration must be between 15 and 480 minutes.' });
    }

    const accessToken = await getGoogleAccessToken(req, res);

    const createBody = {};
    if (autoRecord) {
      createBody.config = {
        artifactConfig: {
          recordingConfig: {
            autoRecordingGeneration: 'ON',
          },
        },
      };
    }

    const meetResponse = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    const meet = await meetResponse.json();
    if (!meetResponse.ok) {
      const message = meet?.error?.message || 'Google Meet could not create the meeting.';
      return res.status(meetResponse.status).json({ error: message, google: meet?.error || null });
    }

    const joinToken = createJoinToken({
      m: meet.meetingUri,
      c: className,
      s: startsAt || null,
      d: durationMinutes,
      e: startsAt
        ? new Date(new Date(startsAt).getTime() + durationMinutes * 60 * 1000 + 24 * 60 * 60 * 1000).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    const origin = process.env.APP_BASE_URL || `https://${req.headers.host}`;
    const joinUrl = `${origin}/join/${joinToken}`;

    const notifications = [];
    if (recipients.length) {
      const startsText = formatStartsAt(startsAt);
      const configured = Boolean(
        process.env.WHATSAPP_GRAPH_VERSION &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_TEMPLATE_NAME
      );

      if (!configured) {
        notifications.push({
          status: 'not_configured',
          message: 'Meeting created, but WhatsApp is not configured on Vercel yet.',
          recipients: recipients.length,
        });
      } else {
        for (const phone of recipients) {
          try {
            const result = await sendWhatsAppClassInvite({
              to: phone,
              className,
              startsAt: startsText,
              joinUrl,
            });
            notifications.push({ status: 'sent', to: phone, id: result?.messages?.[0]?.id || null });
          } catch (error) {
            notifications.push({ status: 'failed', to: phone, error: error.message || 'WhatsApp send failed.' });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      className,
      startsAt: startsAt || null,
      durationMinutes,
      autoRecord,
      meetingName: meet.name || null,
      meetingCode: meet.meetingCode || null,
      meetingUri: meet.meetingUri,
      joinUrl,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not create class.' });
  }
}
