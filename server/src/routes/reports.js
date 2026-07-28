import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function hours(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

async function loadBookings(type, from, to) {
  const where = { bookingType: type };
  if (from || to) {
    where.startDatetime = {};
    if (from) where.startDatetime.gte = new Date(String(from));
    if (to) where.startDatetime.lte = new Date(String(to));
  }
  return prisma.booking.findMany({
    where,
    include: { resource: true, requester: { include: { department: true } }, department: true },
  });
}

// ---- Vehicle report (21.1) ----
router.get('/vehicles', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const bookings = await loadBookings('VEHICLE', from, to);
    const active = bookings.filter((b) => b.status !== 'CANCELLED');
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED');

    const perVehicle = {};
    for (const b of active) {
      const key = b.resource.resourceName;
      perVehicle[key] = perVehicle[key] || { name: key, count: 0, hours: 0 };
      perVehicle[key].count += 1;
      perVehicle[key].hours += hours(b.startDatetime, b.endDatetime);
    }
    const byVehicle = Object.values(perVehicle).map((v) => ({ ...v, hours: round(v.hours) }));
    byVehicle.sort((a, b) => b.count - a.count);

    res.json({
      total: active.length,
      cancelledCount: cancelled.length,
      byVehicle,
      mostBooked: byVehicle[0]?.name || null,
      leastBooked: byVehicle[byVehicle.length - 1]?.name || null,
      byUser: groupBy(active, (b) => b.requester.fullName),
      byDepartment: groupBy(active, (b) => b.department?.departmentName || '—'),
      byPurpose: groupBy(active, (b) => b.purpose || '—'),
      blocks: await blockSummary('VEHICLE'),
    });
  } catch (e) {
    next(e);
  }
});

// ---- Meeting room report (21.2) ----
router.get('/rooms', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const bookings = await loadBookings('MEETING_ROOM', from, to);
    const active = bookings.filter((b) => b.status !== 'CANCELLED');
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED');

    // Busiest hour-of-day.
    const byHour = {};
    let totalHours = 0;
    for (const b of active) {
      const h = new Date(b.startDatetime).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
      totalHours += hours(b.startDatetime, b.endDatetime);
    }
    const busiestHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    res.json({
      total: active.length,
      totalHours: round(totalHours),
      cancelledCount: cancelled.length,
      busiestHour: busiestHour != null ? `${busiestHour}:00` : null,
      byHour: Object.entries(byHour).map(([h, count]) => ({ hour: `${h}:00`, count })),
      byUser: groupBy(active, (b) => b.requester.fullName),
      byDepartment: groupBy(active, (b) => b.department?.departmentName || '—'),
      blocks: await blockSummary('MEETING_ROOM'),
    });
  } catch (e) {
    next(e);
  }
});

// ---- Cancellation report ----
router.get('/cancellations', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'CANCELLED' };
    if (from || to) {
      where.cancelledAt = {};
      if (from) where.cancelledAt.gte = new Date(String(from));
      if (to) where.cancelledAt.lte = new Date(String(to));
    }
    const cancellations = await prisma.booking.findMany({
      where,
      include: { resource: true, requester: true },
      orderBy: { cancelledAt: 'desc' },
    });
    res.json({ count: cancellations.length, cancellations });
  } catch (e) {
    next(e);
  }
});

function round(n) {
  return Math.round(n * 100) / 100;
}
function groupBy(items, keyFn) {
  const map = {};
  for (const it of items) {
    const k = keyFn(it);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
async function blockSummary(type) {
  const resources = await prisma.resource.findMany({ where: { resourceType: type }, select: { id: true } });
  const ids = resources.map((r) => r.id);
  return prisma.resourceBlock.count({ where: { resourceId: { in: ids }, status: 'ACTIVE' } });
}

export default router;
