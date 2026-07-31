import { prisma, withWriteLock } from '../db.js';
import { config } from '../config.js';
import { httpError } from '../middleware/error.js';
import { checkAvailability } from '../utils/overlap.js';
import { nextBookingNumber } from '../utils/bookingNumber.js';
import { expandOccurrences } from '../utils/recurrence.js';
import { notify } from './notifications/index.js';

const ACTIVE_STATUSES = ['CONFIRMED', 'ACTIVE'];

function assertValidWindow(start, end) {
  if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end)) {
    throw httpError(400, 'INVALID_DATE', 'Invalid start/end datetime');
  }
  if (end <= start) {
    throw httpError(400, 'INVALID_RANGE', 'End must be after start'); // rule 22
  }
  if (start < new Date()) {
    throw httpError(400, 'NO_BACKDATING', 'Cannot book in the past'); // rule 22
  }
}

async function loadBookableResource(resourceId) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw httpError(404, 'RESOURCE_NOT_FOUND');
  if (!resource.active) throw httpError(409, 'RESOURCE_DISABLED', 'Resource is disabled');
  return resource;
}

/**
 * Create a single booking. The check+insert runs inside a serialized write
 * transaction (step-2 verification of section 8.2) so two concurrent requests
 * cannot both pass the overlap check.
 */
export async function createBooking({ user, bookingType, resourceId, start, end, purpose, recurringId, departmentId, requesterName }) {
  assertValidWindow(start, end);
  const resource = await loadBookableResource(resourceId);
  if (resource.resourceType !== bookingType) {
    throw httpError(400, 'TYPE_MISMATCH', 'Resource type does not match booking type');
  }

  // Step 1: pre-check (fast feedback, outside the lock)
  const pre = await checkAvailability(null, { resourceId, start, end });
  if (!pre.available) throw conflictError(pre);

  // Step 2: authoritative check inside a serialized transaction
  const booking = await withWriteLock(() =>
    prisma.$transaction(async (tx) => {
      const check = await checkAvailability(tx, { resourceId, start, end });
      if (!check.available) throw conflictError(check);
      const bookingNumber = await nextBookingNumber(tx, bookingType, start, config.tz);
      return tx.booking.create({
        data: {
          bookingNumber,
          bookingType,
          requesterId: user.id,
          requesterName: requesterName || null,
          departmentId: departmentId ?? user.departmentId ?? null,
          resourceId,
          startDatetime: start,
          endDatetime: end,
          purpose: purpose || null,
          status: 'CONFIRMED',
          recurringId: recurringId ?? null,
        },
        include: { resource: true, requester: true },
      });
    })
  );

  await notify({ user, booking, event: 'BOOKING_CREATED' });
  return booking;
}

/**
 * Create a recurring series. Validates EVERY occurrence first (section 7.3):
 * if any date conflicts, nothing is saved and the conflicting dates are returned.
 */
export async function createRecurringBooking({
  user, bookingType, resourceId, start, end, purpose,
  recurrenceType, recurrenceInterval, recurrenceEndDate, departmentId, requesterName,
}) {
  assertValidWindow(start, end);
  const resource = await loadBookableResource(resourceId);
  if (resource.resourceType !== bookingType) {
    throw httpError(400, 'TYPE_MISMATCH');
  }

  const occurrences = expandOccurrences({ start, end, recurrenceType, recurrenceInterval, recurrenceEndDate });

  const result = await withWriteLock(() =>
    prisma.$transaction(async (tx) => {
      // Validate all occurrences up front.
      const conflicts = [];
      for (const occ of occurrences) {
        const check = await checkAvailability(tx, { resourceId, start: occ.start, end: occ.end });
        if (!check.available) {
          conflicts.push({ start: occ.start, end: occ.end, reason: check.reason });
        }
      }
      if (conflicts.length > 0) {
        const e = httpError(409, 'RECURRING_CONFLICT', 'Some occurrences conflict');
        e.conflicts = conflicts;
        throw e;
      }

      const recurring = await tx.recurringBooking.create({
        data: {
          bookingType,
          requesterId: user.id,
          resourceId,
          recurrenceType,
          recurrenceInterval: recurrenceInterval || 1,
          recurrenceEndDate: recurrenceEndDate || null,
          status: 'ACTIVE',
        },
      });

      const created = [];
      for (const occ of occurrences) {
        const bookingNumber = await nextBookingNumber(tx, bookingType, occ.start, config.tz);
        const b = await tx.booking.create({
          data: {
            bookingNumber,
            bookingType,
            requesterId: user.id,
            requesterName: requesterName || null,
            departmentId: departmentId ?? user.departmentId ?? null,
            resourceId,
            startDatetime: occ.start,
            endDatetime: occ.end,
            purpose: purpose || null,
            status: 'CONFIRMED',
            recurringId: recurring.id,
          },
          include: { resource: true },
        });
        created.push(b);
      }
      return { recurring, bookings: created };
    })
  );

  await notify({ user, booking: result.bookings[0], event: 'BOOKING_CREATED', message: `จองแบบเกิดซ้ำสำเร็จ ${result.bookings.length} รายการ / Recurring series created (${result.bookings.length} bookings)` });
  return result;
}

function conflictError(check) {
  const e = httpError(409, check.reason || 'CONFLICT', 'Time slot not available');
  e.conflicts = check.conflicts;
  e.blocks = check.blocks;
  return e;
}

/** Edit a booking (owner before start, or admin any time). */
export async function editBooking({ actor, bookingId, patch }) {
  const existing = await prisma.booking.findUnique({ where: { id: bookingId }, include: { requester: true, resource: true } });
  if (!existing) throw httpError(404, 'BOOKING_NOT_FOUND');

  const isOwner = existing.requesterId === actor.id;
  const isAdmin = actor.role === 'ADMIN';
  if (!isOwner && !isAdmin) throw httpError(403, 'FORBIDDEN'); // rule 22

  if (!isAdmin) {
    if (existing.requesterId !== actor.id) throw httpError(403, 'FORBIDDEN');
    if (['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(existing.status)) {
      throw httpError(409, 'NOT_EDITABLE', 'Cannot edit a finished booking');
    }
    if (new Date(existing.startDatetime) <= new Date()) {
      throw httpError(409, 'ALREADY_STARTED', 'Cannot edit after start time');
    }
  }

  const newResourceId = patch.resourceId ?? existing.resourceId;
  const newStart = patch.start ?? existing.startDatetime;
  const newEnd = patch.end ?? existing.endDatetime;
  assertValidWindow(new Date(newStart), new Date(newEnd));

  const resource = await loadBookableResource(newResourceId);
  if (resource.resourceType !== existing.bookingType) throw httpError(400, 'TYPE_MISMATCH');

  const updated = await withWriteLock(() =>
    prisma.$transaction(async (tx) => {
      // Re-check availability whenever resource/date/time changes (rule 22).
      const check = await checkAvailability(tx, {
        resourceId: newResourceId,
        start: new Date(newStart),
        end: new Date(newEnd),
        excludeBookingId: bookingId,
      });
      if (!check.available) throw conflictError(check);
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          resourceId: newResourceId,
          startDatetime: new Date(newStart),
          endDatetime: new Date(newEnd),
          purpose: patch.purpose !== undefined ? patch.purpose : existing.purpose,
        },
        include: { resource: true, requester: true },
      });
    })
  );

  const event = isAdmin && !isOwner ? 'ADMIN_MODIFIED' : 'BOOKING_UPDATED';
  await notify({ user: existing.requester, booking: updated, event });
  return { existing, updated };
}

/** Cancel a booking (owner before start, or admin). Requires a reason (rule 22). */
export async function cancelBooking({ actor, bookingId, reason }) {
  const existing = await prisma.booking.findUnique({ where: { id: bookingId }, include: { requester: true, resource: true } });
  if (!existing) throw httpError(404, 'BOOKING_NOT_FOUND');

  const isOwner = existing.requesterId === actor.id;
  const isAdmin = actor.role === 'ADMIN';
  if (!isOwner && !isAdmin) throw httpError(403, 'FORBIDDEN');
  if (['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(existing.status)) {
    throw httpError(409, 'NOT_CANCELLABLE', 'Booking already finished');
  }
  if (!isAdmin && new Date(existing.startDatetime) <= new Date()) {
    throw httpError(409, 'ALREADY_STARTED', 'Cannot cancel after start time');
  }
  if (!reason || !reason.trim()) throw httpError(400, 'REASON_REQUIRED', 'Cancellation reason required');

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledById: actor.id,
      cancellationReason: reason.trim(),
    },
    include: { resource: true, requester: true },
  });
  // The freed slot is immediately bookable again (rule 22) because only
  // CONFIRMED/ACTIVE bookings are considered by the overlap check.

  const event = isAdmin && !isOwner ? 'ADMIN_MODIFIED' : 'BOOKING_CANCELLED';
  await notify({ user: existing.requester, booking: updated, event });
  return { existing, updated };
}
