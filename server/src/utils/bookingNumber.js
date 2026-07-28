/**
 * Booking number format:  [TYPE]-[YYYYMM]-[Running]
 *   Vehicle:      VEH-202607-0001
 *   Meeting room: ROOM-202607-0001
 * Running number resets per (type, year-month). Must be generated inside the
 * same transaction as the insert to avoid duplicates under concurrency.
 */
export function prefixFor(bookingType) {
  return bookingType === 'MEETING_ROOM' ? 'ROOM' : 'VEH';
}

export function yearMonth(date, tz = 'Asia/Bangkok') {
  // Format YYYYMM in the given timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  return `${y}${m}`;
}

export async function nextBookingNumber(client, bookingType, referenceDate, tz) {
  const prefix = prefixFor(bookingType);
  const ym = yearMonth(referenceDate, tz);
  const like = `${prefix}-${ym}-%`;

  const last = await client.booking.findFirst({
    where: { bookingNumber: { startsWith: `${prefix}-${ym}-` } },
    orderBy: { bookingNumber: 'desc' },
    select: { bookingNumber: true },
  });

  let running = 1;
  if (last) {
    const tail = last.bookingNumber.split('-').pop();
    running = parseInt(tail, 10) + 1;
  }
  return `${prefix}-${ym}-${String(running).padStart(4, '0')}`;
}
