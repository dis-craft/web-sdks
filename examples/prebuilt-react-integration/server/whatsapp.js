function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) throw new Error('WhatsApp recipient is empty.');
  return digits;
}

export async function sendWhatsAppClassInvite({ to, className, startsAt, joinUrl }) {
  const version = required('WHATSAPP_GRAPH_VERSION');
  const phoneNumberId = required('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = required('WHATSAPP_ACCESS_TOKEN');
  const templateName = required('WHATSAPP_TEMPLATE_NAME');
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizePhone(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: className },
                { type: 'text', text: startsAt || 'soon' },
                { type: 'text', text: joinUrl },
              ],
            },
          ],
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'WhatsApp message failed.');
  }

  return data;
}
