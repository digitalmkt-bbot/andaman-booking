import { prisma } from '../db.js';

/**
 * Write an audit log entry. Never throws — auditing must not break the request.
 */
export async function writeAudit(req, { module, action, recordId, oldValue, newValue }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id ?? null,
        module,
        action,
        recordId: recordId != null ? String(recordId) : null,
        oldValue: oldValue != null ? JSON.stringify(oldValue) : null,
        newValue: newValue != null ? JSON.stringify(newValue) : null,
        ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      },
    });
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}
