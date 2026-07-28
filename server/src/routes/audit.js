import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { module, action, from, to } = req.query;
    const where = {};
    if (module) where.module = module;
    if (action) where.action = action;
    if (from || to) {
      where.actionDatetime = {};
      if (from) where.actionDatetime.gte = new Date(String(from));
      if (to) where.actionDatetime.lte = new Date(String(to));
    }
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { actionDatetime: 'desc' },
      take: 500,
    });
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

export default router;
