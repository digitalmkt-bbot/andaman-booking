import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';

const router = Router();

// ---- List (all authenticated users) ----
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.resourceType = type;
    const resources = await prisma.resource.findMany({
      where,
      include: { vehicle: true, meetingRoom: true },
      orderBy: { id: 'asc' },
    });
    res.json({ resources });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehicle: true, meetingRoom: true },
    });
    if (!resource) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ resource });
  } catch (e) {
    next(e);
  }
});

// ---- Admin: create vehicle ----
const vehicleSchema = z.object({
  resourceCode: z.string().min(1),
  vehicleName: z.string().min(1),
  licensePlate: z.string().optional(),
  color: z.string().optional(),
  imageUrl: z.string().optional(),
  note: z.string().optional(),
});

router.post('/vehicles', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = vehicleSchema.parse(req.body);
    const resource = await prisma.resource.create({
      data: {
        resourceType: 'VEHICLE',
        resourceCode: body.resourceCode,
        resourceName: body.vehicleName,
        imageUrl: body.imageUrl,
        status: 'AVAILABLE',
        active: true,
        vehicle: {
          create: {
            vehicleName: body.vehicleName,
            licensePlate: body.licensePlate,
            color: body.color,
            imageUrl: body.imageUrl,
            note: body.note,
          },
        },
      },
      include: { vehicle: true },
    });
    await writeAudit(req, { module: 'RESOURCE', action: 'CREATE_VEHICLE', recordId: resource.id, newValue: resource });
    res.status(201).json({ resource });
  } catch (e) {
    next(e);
  }
});

router.patch('/vehicles/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const resource = await prisma.resource.update({
      where: { id },
      data: {
        resourceName: body.vehicleName ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
        vehicle: {
          update: {
            vehicleName: body.vehicleName ?? undefined,
            licensePlate: body.licensePlate ?? undefined,
            color: body.color ?? undefined,
            imageUrl: body.imageUrl ?? undefined,
            note: body.note ?? undefined,
          },
        },
      },
      include: { vehicle: true },
    });
    await writeAudit(req, { module: 'RESOURCE', action: 'UPDATE_VEHICLE', recordId: id, newValue: resource });
    res.json({ resource });
  } catch (e) {
    next(e);
  }
});

// ---- Admin: create meeting room ----
const roomSchema = z.object({
  resourceCode: z.string().min(1),
  roomName: z.string().min(1),
  location: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  imageUrl: z.string().optional(),
  note: z.string().optional(),
});

router.post('/rooms', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = roomSchema.parse(req.body);
    const resource = await prisma.resource.create({
      data: {
        resourceType: 'MEETING_ROOM',
        resourceCode: body.resourceCode,
        resourceName: body.roomName,
        imageUrl: body.imageUrl,
        status: 'AVAILABLE',
        active: true,
        meetingRoom: {
          create: {
            roomName: body.roomName,
            location: body.location,
            openingTime: body.openingTime,
            closingTime: body.closingTime,
            imageUrl: body.imageUrl,
            note: body.note,
          },
        },
      },
      include: { meetingRoom: true },
    });
    await writeAudit(req, { module: 'RESOURCE', action: 'CREATE_ROOM', recordId: resource.id });
    res.status(201).json({ resource });
  } catch (e) {
    next(e);
  }
});

router.patch('/rooms/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const resource = await prisma.resource.update({
      where: { id },
      data: {
        resourceName: body.roomName ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
        meetingRoom: {
          update: {
            roomName: body.roomName ?? undefined,
            location: body.location ?? undefined,
            openingTime: body.openingTime ?? undefined,
            closingTime: body.closingTime ?? undefined,
            imageUrl: body.imageUrl ?? undefined,
            note: body.note ?? undefined,
          },
        },
      },
      include: { meetingRoom: true },
    });
    await writeAudit(req, { module: 'RESOURCE', action: 'UPDATE_ROOM', recordId: id });
    res.json({ resource });
  } catch (e) {
    next(e);
  }
});

// ---- Admin: enable/disable a resource ----
router.patch('/:id/active', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const active = Boolean(req.body.active);
    const resource = await prisma.resource.update({
      where: { id },
      data: { active, status: active ? 'AVAILABLE' : 'DISABLED' },
    });
    await writeAudit(req, { module: 'RESOURCE', action: active ? 'ENABLE' : 'DISABLE', recordId: id });
    res.json({ resource });
  } catch (e) {
    next(e);
  }
});

export default router;
