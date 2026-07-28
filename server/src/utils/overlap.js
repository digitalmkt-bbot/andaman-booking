import { prisma } from '../db.js';

/**
 * Two intervals [aStart, aEnd) and [bStart, bEnd) overlap iff
 * aStart < bEnd AND bStart < aEnd. Touching edges (end === start) do NOT overlap,
 * matching the spec: an existing 09:00–11:00 booking allows 07:00–09:00 and 11:00–12:00.
 */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find conflicting bookings for a resource in [start, end).
 * Only CONFIRMED/ACTIVE bookings count. `excludeBookingId` skips the booking
 * being edited so it doesn't conflict with itself.
 */
export async function findBookingConflicts(client, { resourceId, start, end, excludeBookingId }) {
  const db = client || prisma;
  return db.booking.findMany({
    where: {
      resourceId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      // candidate.start < end AND candidate.end > start
      startDatetime: { lt: end },
      endDatetime: { gt: start },
    },
    select: {
      id: true,
      bookingNumber: true,
      startDatetime: true,
      endDatetime: true,
      requesterId: true,
    },
  });
}

/** Find active resource blocks that conflict with [start, end). */
export async function findBlockConflicts(client, { resourceId, start, end }) {
  const db = client || prisma;
  return db.resourceBlock.findMany({
    where: {
      resourceId,
      status: 'ACTIVE',
      startDatetime: { lt: end },
      endDatetime: { gt: start },
    },
    select: { id: true, reason: true, blockType: true, startDatetime: true, endDatetime: true },
  });
}

/**
 * Full availability check: returns { available: boolean, reason, conflicts, blocks }.
 * Used both for the pre-check (step 1) and inside the transaction (step 2).
 */
export async function checkAvailability(client, { resourceId, start, end, excludeBookingId }) {
  const [conflicts, blocks] = await Promise.all([
    findBookingConflicts(client, { resourceId, start, end, excludeBookingId }),
    findBlockConflicts(client, { resourceId, start, end }),
  ]);
  if (conflicts.length > 0) {
    return { available: false, reason: 'BOOKING_OVERLAP', conflicts, blocks: [] };
  }
  if (blocks.length > 0) {
    return { available: false, reason: 'RESOURCE_BLOCKED', conflicts: [], blocks };
  }
  return { available: true, reason: null, conflicts: [], blocks: [] };
}
