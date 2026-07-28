import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { id: 'asc' } });
    res.json({ departments });
  } catch (e) {
    next(e);
  }
});

const schema = z.object({
  departmentCode: z.string().min(1),
  departmentName: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const department = await prisma.department.create({ data: body });
    await writeAudit(req, { module: 'DEPARTMENT', action: 'CREATE', recordId: department.id });
    res.status(201).json({ department });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const department = await prisma.department.update({
      where: { id },
      data: {
        departmentName: req.body.departmentName ?? undefined,
        status: req.body.status ?? undefined,
      },
    });
    await writeAudit(req, { module: 'DEPARTMENT', action: 'UPDATE', recordId: id });
    res.json({ department });
  } catch (e) {
    next(e);
  }
});

export default router;
