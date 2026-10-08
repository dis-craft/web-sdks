# Google Meet + WhatsApp class flow

This app can create scheduled Google Meet classes from the admin portal and send students a WhatsApp template message containing an academy-owned join URL.

## Flow

1. Admin signs in at `/admin`.
2. Admin connects the academy Google account.
3. Admin creates a class with a date/time, duration, optional description and optional auto-recording.
4. The backend creates a Google Calendar event with a unique Google Meet conference.
5. The backend creates a signed URL such as `/join/<token>`.
6. Students receive the academy URL through WhatsApp.
7. The academy URL resolves the signed token and redirects the student to Google Meet.

Google Meet and Calendar secrets are server-side only.

## Google Cloud setup

Create a Google Cloud project, enable:
- Google Meet REST API
- Google Calendar API

Create an OAuth 2.0 Web application client.

Add the exact redirect URI:
`https://YOUR-DOMAIN/api/google/callback`

Grant the OAuth scopes requested by `server/googleAuth.js`, including Meet space creation/settings and Calendar event creation.

## WhatsApp setup

Use the WhatsApp Business Platform / Cloud API. Create an approved message template named by `WHATSAPP_TEMPLATE_NAME` with three body placeholders:

`{{1}}` class name
`{{2}}` class date/time
`{{3}}` academy join URL

Set the WhatsApp environment variables in Vercel.

The student-facing WhatsApp message contains the academy URL, not the raw Google Meet URL.

## Vercel

Keep the Vercel project root at:
`examples/prebuilt-react-integration`

The existing `vercel.json` runs the monorepo build and publishes `dist`.

Add the variables from `.env.example` in Vercel Project Settings -> Environment Variables for Production and Preview as appropriate.

For local development, use a secure HTTPS tunnel when testing Google OAuth callbacks; the callback URL must exactly match the one registered in Google Cloud.

## Security notes

The current admin page uses server-side HttpOnly admin sessions and the class-creation endpoint rejects unauthenticated requests.

The Google OAuth tokens are stored in an encrypted HttpOnly cookie. Join URLs are HMAC-signed and expire.

The demo still needs a real production identity system / database if multiple admins, teacher accounts, class history, cancellation, reporting, or persistent student records are required.
