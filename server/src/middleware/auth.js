import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
  next();
}
