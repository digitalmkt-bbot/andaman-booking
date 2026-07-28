/**
 * Expand a recurring booking definition into concrete [start, end] occurrences.
 * recurrenceType: NONE | DAILY | WEEKLY | MONTHLY
 * The first occurrence is the given start/end; subsequent ones step by interval
 * until (and including) recurrenceEndDate.
 */
export function expandOccurrences({ start, end, recurrenceType, recurrenceInterval = 1, recurrenceEndDate }) {
  const occurrences = [];
  const durationMs = end.getTime() - start.getTime();

  if (recurrenceType === 'NONE' || !recurrenceType) {
    return [{ start: new Date(start), end: new Date(end) }];
  }

  const endLimit = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
  // Safety cap so a bad end date can't create an unbounded set.
  const MAX = 366;
  let cursor = new Date(start);
  let count = 0;

  while (count < MAX) {
    if (endLimit && cursor > endLimit) break;
    const occStart = new Date(cursor);
    const occEnd = new Date(cursor.getTime() + durationMs);
    occurrences.push({ start: occStart, end: occEnd });

    const next = new Date(cursor);
    if (recurrenceType === 'DAILY') next.setDate(next.getDate() + recurrenceInterval);
    else if (recurrenceType === 'WEEKLY') next.setDate(next.getDate() + 7 * recurrenceInterval);
    else if (recurrenceType === 'MONTHLY') next.setMonth(next.getMonth() + recurrenceInterval);
    else break;
    cursor = next;
    count += 1;
    if (!endLimit) break; // no end date => single occurrence
  }
  return occurrences;
}
