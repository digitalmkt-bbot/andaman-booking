import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { checkAvailability } from '../utils/overlap.js';
import {
  createBooking,
  createRecurringBooking,
  editBooking,
  cancelBooking,
} from '../services/bookings.js';

const router = Router();

const isoDate = z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid datetime');

// ---- Availability check (section 5.3 / 8.1) ----
const availabilitySchema = z.object({
  bookingType: z.enum(['VEHICLE', 'MEETING_ROOM']),
  start: isoDate,
  end: isoDate,
  excludeBookingId: z.number().int().optional(),
});

router.post('/availability', requireAuth, async (req, res, next) => {
  try {
    const { bookingType, start, end, excludeBookingId } = availabilitySchema.parse(req.body);
    const s = new Date(start);
    const e = new Date(end);
    const resources = await prisma.resource.findMany({
      where: { resourceType: bookingType },
      include: { vehicle: true, meetingRoom: true },
    });
    const results = [];
    for (const r of resources) {
      if (!r.active) {
        results.push({ resourceId: r.id, name: r.resourceName, available: false, reason: 'DISABLED' });
        continue;
      }
      const check = await checkAvailability(null, { resourceId: r.id, start: s, end: e, excludeBookingId });
      results.push({
        resourceId: r.id,
        name: r.resourceName,
        code: r.resourceCode,
        vehicle: r.vehicle,
        meetingRoom: r.meetingRoom,
        available: check.available,
        reason: check.reason,
      });
    }
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

// ---- List bookings ----
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { scope, status, resourceId, bookingType, from, to, requesterId, departmentId } = req.query;
    const where = {};

    // Non-admins can only see their own via scope=mine; admins can see all.
    if (scope === 'mine' || req.user.role !== 'ADMIN') {
      where.requesterId = req.user.id;
    }
    if (req.user.role === 'ADMIN' && requesterId) where.requesterId = Number(requesterId);
    if (status) where.status = { in: String(status).split(',') };
    if (resourceId) where.resourceId = Number(resourceId);
    if (bookingType) where.bookingType = bookingType;
    if (departmentId) where.departmentId = Number(departmentId);
    if (from || to) {
      where.startDatetime = {};
      if (from) where.startDatetime.gte = new Date(String(from));
      if (to) where.startDatetime.lte = new Date(String(to));
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: { resource: true, requester: { include: { department: true } }, department: true },
      orderBy: { startDatetime: 'desc' },
      take: 500,
    });
    res.json({ bookings });
  } catch (e) {
    next(e);
  }
});

// ---- Calendar feed ----
router.get('/calendar', requireAuth, async (req, res, next) => {
  try {
    const { from, to, resourceId, bookingType } = req.query;
    const where = { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } };
    if (resourceId) where.resourceId = Number(resourceId);
    if (bookingType) where.bookingType = bookingType;
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endDatetime: { gte: new Date(String(from)) } });
      if (to) where.AND.push({ startDatetime: { lte: new Date(String(to)) } });
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: { resource: true, requester: true, department: true },
      orderBy: { startDatetime: 'asc' },
    });
    // Include resource blocks as calendar entries.
    const blockWhere = { status: 'ACTIVE' };
    if (resourceId) blockWhere.resourceId = Number(resourceId);
    const blocks = await prisma.resourceBlock.findMany({
      where: blockWhere,
      include: { resource: true },
    });
    res.json({ bookings, blocks });
  } catch (e) {
    next(e);
  }
});

// ---- Get one ----
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(req.params.id) },
      include: { resource: { include: { vehicle: true, meetingRoom: true } }, requester: { include: { department: true } }, department: true },
    });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (req.user.role !== 'ADMIN' && booking.requesterId !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    res.json({ booking });
  } catch (e) {
    next(e);
  }
});

// ---- Create ----
const createSchema = z.object({
  bookingType: z.enum(['VEHICLE', 'MEETING_ROOM']),
  resourceId: z.number().int(),
  start: isoDate,
  end: isoDate,
  purpose: z.string().optional().nullable(),
  departmentId: z.number().int().optional().nullable(),
  requesterName: z.string().optional().nullable(),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const booking = await createBooking({
      user: req.user,
      bookingType: body.bookingType,
      resourceId: body.resourceId,
      start: new Date(body.start),
      end: new Date(body.end),
      purpose: body.purpose,
      departmentId: body.departmentId,
      requesterName: body.requesterName,
    });
    await writeAudit(req, { module: 'BOOKING', action: 'CREATE', recordId: booking.id, newValue: booking });
    res.status(201).json({ booking });
  } catch (e) {
    if (e.conflicts || e.blocks) {
      return res.status(e.status || 409).json({ error: e.code, conflicts: e.conflicts, blocks: e.blocks });
    }
    next(e);
  }
});

// ---- Create recurring ----
const recurringSchema = createSchema.extend({
  recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  recurrenceInterval: z.number().int().positive().optional(),
  recurrenceEndDate: isoDate,
});

router.post('/recurring', requireAuth, async (req, res, next) => {
  try {
    const body = recurringSchema.parse(req.body);
    const result = await createRecurringBooking({
      user: req.user,
      bookingType: body.bookingType,
      resourceId: body.resourceId,
      start: new Date(body.start),
      end: new Date(body.end),
      purpose: body.purpose,
      recurrenceType: body.recurrenceType,
      recurrenceInterval: body.recurrenceInterval,
      recurrenceEndDate: new Date(body.recurrenceEndDate),
      departmentId: body.departmentId,
      requesterName: body.requesterName,
    });
    await writeAudit(req, { module: 'BOOKING', action: 'CREATE_RECURRING', recordId: result.recurring.id });
    res.status(201).json({ recurringId: result.recurring.id, count: result.bookings.length, bookings: result.bookings });
  } catch (e) {
    if (e.conflicts) return res.status(409).json({ error: e.code, conflicts: e.conflicts });
    next(e);
  }
});

// ---- Edit ----
const editSchema = z.object({
  resourceId: z.number().int().optional(),
  start: isoDate.optional(),
  end: isoDate.optional(),
  purpose: z.string().optional().nullable(),
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const patch = editSchema.parse(req.body);
    const { existing, updated } = await editBooking({
      actor: req.user,
      bookingId: Number(req.params.id),
      patch: {
        resourceId: patch.resourceId,
        start: patch.start ? new Date(patch.start) : undefined,
        end: patch.end ? new Date(patch.end) : undefined,
        purpose: patch.purpose,
      },
    });
    await writeAudit(req, { module: 'BOOKING', action: 'EDIT', recordId: updated.id, oldValue: existing, newValue: updated });
    res.json({ booking: updated });
  } catch (e) {
    if (e.conflicts || e.blocks) {
      return res.status(e.status || 409).json({ error: e.code, conflicts: e.conflicts, blocks: e.blocks });
    }
    next(e);
  }
});

// ---- Cancel ----
const cancelSchema = z.object({ reason: z.string().min(1) });

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { reason } = cancelSchema.parse(req.body);
    const { existing, updated } = await cancelBooking({
      actor: req.user,
      bookingId: Number(req.params.id),
      reason,
    });
    await writeAudit(req, { module: 'BOOKING', action: 'CANCEL', recordId: updated.id, oldValue: existing, newValue: updated });
    res.json({ booking: updated });
  } catch (e) {
    next(e);
  }
});

export default router;
