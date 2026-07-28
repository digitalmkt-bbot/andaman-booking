import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { publicUser } from './auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { department: true },
      orderBy: { id: 'asc' },
    });
    res.json({ users: users.map(publicUser) });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  departmentId: z.number().int().optional().nullable(),
});

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        employeeCode: body.employeeCode,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        passwordHash,
        role: body.role,
        departmentId: body.departmentId ?? null,
      },
      include: { department: true },
    });
    await writeAudit(req, { module: 'USER', action: 'CREATE', recordId: user.id });
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  departmentId: z.number().int().optional().nullable(),
  password: z.string().min(6).optional(),
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = updateSchema.parse(req.body);
    const data = {
      fullName: body.fullName,
      phone: body.phone,
      role: body.role,
      status: body.status,
      departmentId: body.departmentId,
    };
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.update({ where: { id }, data, include: { department: true } });
    await writeAudit(req, { module: 'USER', action: 'UPDATE', recordId: id });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
