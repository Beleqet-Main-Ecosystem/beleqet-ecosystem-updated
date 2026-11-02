import { Prisma } from '@prisma/client';

/**
 * Published jobs still taking applications: the deadline hasn't passed (it counts through the
 * whole deadline day) and any expiry date is still ahead.
 */
export function openJobs(now = new Date()): Prisma.JobWhereInput {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    status: 'PUBLISHED',
    AND: [
      { OR: [{ deadline: null }, { deadline: { gte: today } }] },
      { OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] },
    ],
  };
}
