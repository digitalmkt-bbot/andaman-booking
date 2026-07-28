import { config } from '../../config.js';

/**
 * Microsoft Graph (Outlook Calendar) event creation via client-credentials flow.
 * Functional skeleton using global fetch. Enable with OUTLOOK_ENABLED=true.
 */
async function getGraphToken() {
  const { tenantId, clientId, clientSecret } = config.integrations.outlook;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`Outlook token failed: ${res.status}`);
  return (await res.json()).access_token;
}

export async function syncOutlook({ booking, event }) {
  if (!config.integrations.outlook.enabled) return;
  if (event === 'BOOKING_CANCELLED') return;
  const token = await getGraphToken();
  const userId = config.integrations.outlook.userId;
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: `${booking.bookingNumber} — ${booking.resource?.resourceName || ''}`,
      body: { contentType: 'Text', content: booking.purpose || '' },
      start: { dateTime: booking.startDatetime.toISOString(), timeZone: config.tz },
      end: { dateTime: booking.endDatetime.toISOString(), timeZone: config.tz },
    }),
  });
  if (!res.ok) throw new Error(`Outlook event failed: ${res.status}`);
}
