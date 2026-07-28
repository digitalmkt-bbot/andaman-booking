import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { sendEmail } from './email.js';
import { sendLine } from './line.js';
import { syncGoogleCalendar } from './googleCalendar.js';
import { syncOutlook } from './outlook.js';

/**
 * Central notification dispatcher.
 * In-app notifications are always persisted. External channels fire only when
 * their integration is enabled + configured; failures are logged, never thrown.
 *
 * event: BOOKING_CREATED | BOOKING_UPDATED | BOOKING_CANCELLED | REMINDER
 *        | RESOURCE_BLOCKED | ADMIN_MODIFIED
 */
export async function notify({ user, booking, event, message }) {
  const text = message || defaultMessage(event, booking);

  // 1. In-app (always)
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        bookingId: booking?.id ?? null,
        notificationType: event,
        channel: 'IN_APP',
        message: text,
        status: 'SENT',
      },
    });
  } catch (e) {
    console.error('in-app notification failed', e.message);
  }

  // 2. External channels (best-effort)
  const external = [];
  if (config.integrations.email.enabled && user.email) {
    external.push(record(user, booking, event, 'EMAIL', () => sendEmail({ to: user.email, subject: subjectFor(event), text })));
  }
  if (config.integrations.line.enabled) {
    external.push(record(user, booking, event, 'LINE', () => sendLine({ user, text })));
  }
  if (config.integrations.google.enabled && booking) {
    external.push(record(user, booking, event, 'GOOGLE_CALENDAR', () => syncGoogleCalendar({ booking, event })));
  }
  if (config.integrations.outlook.enabled && booking) {
    external.push(record(user, booking, event, 'OUTLOOK', () => syncOutlook({ booking, event })));
  }
  await Promise.allSettled(external);
}

async function record(user, booking, event, channel, fn) {
  let status = 'SENT';
  try {
    await fn();
  } catch (e) {
    status = 'FAILED';
    console.error(`${channel} notification failed:`, e.message);
  }
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        bookingId: booking?.id ?? null,
        notificationType: event,
        channel,
        message: subjectFor(event),
        status,
      },
    });
  } catch (e) {
    /* ignore */
  }
}

function subjectFor(event) {
  const map = {
    BOOKING_CREATED: 'จองสำเร็จ / Booking confirmed',
    BOOKING_UPDATED: 'แก้ไขรายการจอง / Booking updated',
    BOOKING_CANCELLED: 'ยกเลิกรายการจอง / Booking cancelled',
    REMINDER: 'แจ้งเตือนก่อนถึงเวลาใช้งาน / Upcoming booking reminder',
    RESOURCE_BLOCKED: 'ทรัพยากรถูกปิดใช้งาน / Resource blocked',
    ADMIN_MODIFIED: 'รายการจองถูกแก้ไขโดยผู้ดูแลระบบ / Modified by admin',
  };
  return map[event] || 'การแจ้งเตือน / Notification';
}

function defaultMessage(event, booking) {
  const label = booking?.bookingNumber ? ` (${booking.bookingNumber})` : '';
  return `${subjectFor(event)}${label}`;
}
