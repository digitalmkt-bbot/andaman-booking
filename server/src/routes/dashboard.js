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
    ]);

    const availableVehicles = vehicles.filter((v) => v.active && v.status === 'AVAILABLE').length;
    const bookedVehicles = vehicles.filter((v) => v.status === 'BOOKED' || v.status === 'IN_USE').length;
    const disabledVehicles = vehicles.filter((v) => !v.active || v.status === 'DISABLED').length;

    res.json({
      todayBookings,
      vehicleTotal: vehicles.length,
      availableVehicles,
      bookedVehicles,
      disabledVehicles,
      inUseCount: inUse.length,
      inUse,
      disabledCount: disabled,
      room: rooms[0] || null,
      currentBookings,
      upcoming,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
