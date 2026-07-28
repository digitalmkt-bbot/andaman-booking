import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { notify } from '../services/notifications/index.js';

const router = Router();
const isoDate = z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid datetime');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { resourceId, status } = req.query;
    const where = {};
    if (resourceId) where.resourceId = Number(resourceId);
    if (status) where.status = status;
    const blocks = await prisma.resourceBlock.findMany({
      where,
      include: { resource: true, createdBy: true },
      orderBy: { startDatetime: 'desc' },
    });
    res.json({ blocks });
  } catch (e) {
    next(e);
  }
});

const blockSchema = z.object({
  resourceId: z.number().int(),
  start: isoDate,
  end: isoDate,
  blockType: z.enum(['MAINTENANCE', 'CLEANING', 'INTERNAL', 'UNAVAILABLE', 'OTHER']),
  reason: z.string().optional(),
});

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = blockSchema.parse(req.body);
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (end <= start) return res.status(400).json({ error: 'INVALID_RANGE' });

    const block = await prisma.resourceBlock.create({
      data: {
        resourceId: body.resourceId,
        startDatetime: start,
        endDatetime: end,
        blockType: body.blockType,
        reason: body.reason,
        createdById: req.user.id,
        status: 'ACTIVE',
      },
      include: { resource: true },
    });
    await writeAudit(req, { module: 'BLOCK', action: 'CREATE', recordId: block.id, newValue: block });

    // Notify affected booking owners (their bookings overlap the block window).
    const affected = await prisma.booking.findMany({
      where: {
        resourceId: body.resourceId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        startDatetime: { lt: end },
        endDatetime: { gt: start },
      },
      include: { requester: true, resource: true },
    });
    for (const b of affected) {
      await notify({ user: b.requester, booking: b, event: 'RESOURCE_BLOCKED' });
    }

    res.status(201).json({ block, affectedBookings: affected.length });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/cancel', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const block = await prisma.resourceBlock.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await writeAudit(req, { module: 'BLOCK', action: 'CANCEL', recordId: id });
    res.json({ block });
  } catch (e) {
    next(e);
  }
});

export default router;
