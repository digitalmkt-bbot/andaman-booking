import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Serialize write-heavy overlap-critical transactions in a single-process app.
// SQLite already serializes writers; for Postgres, wrap the check+insert in a
// SERIALIZABLE transaction (see bookings service) or use advisory locks.
let chain = Promise.resolve();
export function withWriteLock(fn) {
  const run = chain.then(fn, fn);
  // keep the chain alive regardless of individual outcome
  chain = run.then(() => {}, () => {});
  return run;
}
