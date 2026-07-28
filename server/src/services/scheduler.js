import cron from 'node-cron';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { notify } from './notifications/index.js';

/**
 * Automatic status transitions (section 10):
 *   CONFIRMED -> ACTIVE     when now >= start
 *   ACTIVE    -> COMPLETED  when now >= end
 *   CONFIRMED -> EXPIRED    if somehow start passed but was never activated
 *                           (edge case; keeps data consistent)
 * Also fires REMINDER notifications REMINDER_LEAD_MINUTES before start.
 */
export async function runStatusTransitions(now = new Date()) {
  // CONFIRMED -> ACTIVE
  await prisma.booking.updateMany({
    where: { status: 'CONFIRMED', startDatetime: { lte: now }, endDatetime: { gt: now } },
    data: { status: 'ACTIVE' },
  });

  // ACTIVE -> COMPLETED
  await prisma.booking.updateMany({
    where: { status: 'ACTIVE', endDatetime: { lte: now } },
    data: { status: 'COMPLETED' },
  });

  // CONFIRMED but already ended (never activated within a tick) -> COMPLETED
  await prisma.booking.updateMany({
    where: { status: 'CONFIRMED', endDatetime: { lte: now } },
    data: { status: 'COMPLETED' },
  });

  await refreshResourceStatuses(now);
}

/** Recompute each resource's live status flag for the dashboard. */
export async function refreshResourceStatuses(now = new Date()) {
  const resources = await prisma.resource.findMany({ select: { id: true, active: true } });
  for (const r of resources) {
    if (!r.active) continue;
    const active = await prisma.booking.count({
      where: { resourceId: r.id, status: 'ACTIVE', startDatetime: { lte: now }, endDatetime: { gt: now } },
    });
    const block = await prisma.resourceBlock.count({
      where: { resourceId: r.id, status: 'ACTIVE', startDatetime: { lte: now }, endDatetime: { gt: now } },
    });
    const upcoming = await prisma.booking.count({
      where: { resourceId: r.id, status: 'CONFIRMED', startDatetime: { gt: now } },
    });
    let status = 'AVAILABLE';
    if (block) status = 'DISABLED';
    else if (active) status = 'IN_USE';
    else if (upcoming) status = 'BOOKED';
    await prisma.resource.update({ where: { id: r.id }, data: { status } });
  }
}

let remindersSent = new Set();
export async function runReminders(now = new Date()) {
  const lead = config.reminderLeadMinutes;
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + lead * 60000);
  const soon = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', startDatetime: { gt: windowStart, lte: windowEnd } },
    include: { requester: true, resource: true },
  });
  for (const b of soon) {
    if (remindersSent.has(b.id)) continue;
    remindersSent.add(b.id);
    await notify({ user: b.requester, booking: b, event: 'REMINDER' });
  }
  // prevent unbounded growth
  if (remindersSent.size > 5000) remindersSent = new Set();
}

export function startScheduler() {
  // Every minute.
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await runStatusTransitions();
        await runReminders();
      } catch (e) {
        console.error('scheduler tick failed', e.message);
      }
    },
    { timezone: config.tz }
  );
  console.log(`Scheduler started (timezone ${config.tz}).`);
  // Run once on boot so statuses are correct immediately.
  runStatusTransitions().catch((e) => console.error(e.message));
}
