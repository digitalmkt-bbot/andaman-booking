import { config } from '../../config.js';

// googleapis is optional. Install with: npm i googleapis
/**
 * Creates/updates a Google Calendar event for a booking. This is a functional
 * skeleton: it authenticates with a service account JSON and inserts an event.
 * Enable with GOOGLE_CALENDAR_ENABLED=true and provide credentials.
 */
export async function syncGoogleCalendar({ booking, event }) {
  if (!config.integrations.google.enabled) return;
  let google;
  try {
    ({ google } = await import('googleapis'));
  } catch {
    console.warn('googleapis not installed — Google Calendar disabled. Run: npm i googleapis');
    return;
  }
  if (event === 'BOOKING_CANCELLED') return; // deletion left to real impl

  const credentials = JSON.parse(config.integrations.google.credentials || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.insert({
    calendarId: config.integrations.google.calendarId,
    requestBody: {
      summary: `${booking.bookingNumber} — ${booking.resource?.resourceName || ''}`,
      description: booking.purpose || '',
      start: { dateTime: booking.startDatetime.toISOString(), timeZone: config.tz },
      end: { dateTime: booking.endDatetime.toISOString(), timeZone: config.tz },
    },
  });
}
