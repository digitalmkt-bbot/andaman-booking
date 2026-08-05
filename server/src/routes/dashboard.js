import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const [
      todayBookings,
      vehicles,
      rooms,
      inUse,
      disabled,
      currentBookings,
      upcoming,
      todaysVehBookings,
    ] = await Promise.all([
      prisma.booking.count({
        where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }, startDatetime: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.resource.findMany({ where: { resourceType: 'VEHICLE' } }),
      prisma.resource.findMany({ where: { resourceType: 'MEETING_ROOM' } }),
      prisma.booking.findMany({
        where: { status: 'ACTIVE', startDatetime: { lte: now }, endDatetime: { gt: now } },
        include: { resource: true, requester: true },
      }),
      prisma.resource.count({ where: { OR: [{ active: false }, { status: 'DISABLED' }] } }),
      prisma.booking.findMany({
        where: { status: 'ACTIVE' },
        include: { resource: true, requester: true },
        orderBy: { startDatetime: 'asc' },
        take: 20,
      }),
      prisma.booking.findMany({
        where: { status: 'CONFIRMED', startDatetime: { gte: now } },
        include: { resource: true, requester: true },
        orderBy: { startDatetime: 'asc' },
        take: 10,
      }),
      // Today's vehicle bookings (to compute per-vehicle live status).
      prisma.booking.findMany({
        where: {
          bookingType: 'VEHICLE',
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startDatetime: { lte: todayEnd },
          endDatetime: { gte: todayStart },
        },
        include: { requester: true },
        orderBy: { startDatetime: 'asc' },
      }),
    ]);

    // Per-vehicle live status for today (in use now / available / next booking).
    const vehicleStatus = vehicles.map((v) => {
      const dayBk = todaysVehBookings.filter((b) => b.resourceId === v.id);
      const cur = dayBk.find((b) => new Date(b.startDatetime) <= now && new Date(b.endDatetime) > now) || null;
      const nxt = dayBk.find((b) => new Date(b.startDatetime) > now) || null;
      const isDisabled = !v.active || v.status === 'DISABLED';
      return {
        id: v.id,
        name: v.resourceName,
        disabled: isDisabled,
        current: cur ? { start: cur.startDatetime, end: cur.endDatetime, requester: cur.requesterName || cur.requester?.fullName || null } : null,
        next: nxt ? { start: nxt.startDatetime, end: nxt.endDatetime, requester: nxt.requesterName || nxt.requester?.fullName || null } : null,
      };
    });
    const inUseVehicles = vehicleStatus.filter((s) => s.current).length;
    const freeVehicles = vehicleStatus.filter((s) => !s.disabled && !s.current).length;

    const disabledVehicles = vehicles.filter((v) => !v.active || v.status === 'DISABLED').length;

    res.json({
      todayBookings,
      vehicleTotal: vehicles.length,
      availableVehicles: freeVehicles,
      bookedVehicles: inUseVehicles,
      disabledVehicles,
      inUseCount: inUse.length,
      inUse,
      disabledCount: disabled,
      room: rooms[0] || null,
      currentBookings,
      upcoming,
      vehicleStatus,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
