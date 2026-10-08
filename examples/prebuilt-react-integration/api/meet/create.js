import crypto from 'node:crypto';
import { getGoogleAccessToken } from '../../server/googleAuth.js';
import { createJoinToken } from '../../server/joinLinks.js';
import { sendWhatsAppClassInvite } from '../../server/whatsapp.js';

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function randomRequestId() {
  return crypto.randomUUID();
}

function toRfc3339(value) {
  const raw = cleanString(value);
  if (!raw) throw new Error('Class date and time are required.');
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) return new Date(raw).toISOString();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    // datetime-local values are interpreted as academy local time.
    const withZone = new Date(raw + '+05:30');
    if (Number.isNaN(withZone.getTime())) throw new Error('Invalid class date and time.');
    return withZone.toISOString();
  }
  return date.toISOString();
}

function formatStartsAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

async function googleRequest(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Google API request failed.';
    throw new Error(message);
  }
  return data;
}

async function getCalendarEvent(accessToken, eventId) {
  return googleRequest(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken,
  );
}

async function createScheduledMeetEvent(accessToken, { className, description, startsAt, durationMinutes }) {
  const startIso = toRfc3339(startsAt);
  const startMs = new Date(startIso).getTime();
  const endIso = new Date(startMs + durationMinutes * 60 * 1000).toISOString();

  const body = {
    summary: className,
    description: description || 'Live class created from the academy admin console.',
    start: {
      dateTime: startIso,
      timeZone: APP_TIMEZONE,
    },
    end: {
      dateTime: endIso,
      timeZone: APP_TIMEZONE,
    },
    conferenceData: {
      createRequest: {
        requestId: randomRequestId(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
  const event = await googleRequest(url, accessToken, { method: 'POST', body: JSON.stringify(body) });

  if (event.conferenceData?.entryPoints?.some(entry => entry.entryPointType === 'video')) {
    return event;
  }

  // Conference creation can be asynchronous. Give Calendar a few short chances to finish.
  for (let i = 0; i < 6; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const current = await getCalendarEvent(accessToken, event.id);
    if (current.conferenceData?.entryPoints?.some(entry => entry.entryPointType === 'video')) {
      return current;
    }
  }

  throw new Error('Google created the calendar event, but the Meet link is still being generated. Refresh the class in a moment.');
}

async function enableAutoRecording(accessToken, meetingCode) {
  if (!meetingCode) return false;
  try {
    const space = await googleRequest(
      `https://meet.googleapis.com/v2/spaces/${encodeURIComponent(meetingCode)}`,
      accessToken,
    );

    await googleRequest(
      `https://meet.googleapis.com/v2/${space.name}?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: space.name,
          config: {
            artifactConfig: {
              recordingConfig: {
                autoRecordingGeneration: 'ON',
              },
            },
          },
        }),
      },
    );
    return true;
  } catch (error) {
    throw new Error(`Meet was created, but automatic recording could not be enabled: ${error.message}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const body = req.body || {};
    const className = cleanString(body.className);
    const description = cleanString(body.description);
    const startsAt = cleanString(body.startsAt);
    const durationMinutes = Number(body.durationMinutes || 60);
    const autoRecord = Boolean(body.autoRecord);
    const recipients = Array.isArray(body.whatsappNumbers)
      ? body.whatsappNumbers.map(cleanString).filter(Boolean).slice(0, 200)
      : [];

    if (!className) return res.status(400).json({ error: 'Class name is required.' });
    if (!startsAt) return res.status(400).json({ error: 'Class date and time are required.' });
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return res.status(400).json({ error: 'Duration must be between 15 and 480 minutes.' });
    }

    const startIso = toRfc3339(startsAt);
    if (new Date(startIso).getTime() < Date.now() - 60_000) {
      return res.status(400).json({ error: 'Class date/time must be in the future.' });
    }

    const accessToken = await getGoogleAccessToken(req, res);
    const event = await createScheduledMeetEvent(accessToken, {
      className,
      description,
      startsAt: startIso,
      durationMinutes,
    });

    const videoEntry = event.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video');
    const meetingUri = videoEntry?.uri;
    const meetingCode =
      event.conferenceData?.conferenceId ||
      videoEntry?.meetingCode ||
      null;

    if (!meetingUri) {
      return res.status(502).json({ error: 'Google Calendar created the class but returned no Meet join link yet.' });
    }

    let recordingEnabled = false;
    if (autoRecord) {
      recordingEnabled = await enableAutoRecording(accessToken, meetingCode);
    }

    const joinToken = createJoinToken({
      m: meetingUri,
      c: className,
      s: startIso,
      d: durationMinutes,
      e: new Date(new Date(startIso).getTime() + durationMinutes * 60 * 1000 + 24 * 60 * 60 * 1000).getTime(),
    });

    const origin = process.env.APP_BASE_URL || `https://${req.headers.host}`;
    const joinUrl = `${origin}/join/${joinToken}`;

    const notifications = [];
    if (recipients.length) {
      const startsText = formatStartsAt(startIso);
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
      startsAt: startIso,
      durationMinutes,
      autoRecord,
      recordingEnabled,
      meetingCode,
      meetingUri,
      joinUrl,
      calendarEventId: event.id,
      calendarHtmlLink: event.htmlLink || null,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not create class.' });
  }
}
