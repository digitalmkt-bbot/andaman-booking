import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id, channel: 'IN_APP' },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    const unread = notifications.filter((n) => !n.readAt).length;
    res.json({ notifications, unread });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== req.user.id) return res.status(404).json({ error: 'NOT_FOUND' });
    await prisma.notification.update({ where: { id }, data: { readAt: new Date(), status: 'READ' } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
