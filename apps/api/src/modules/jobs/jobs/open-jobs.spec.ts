import { openJobs } from './open-jobs';

describe('openJobs', () => {
  it('keeps a job open through its whole deadline day', () => {
    const where = openJobs(new Date('2026-11-02T18:30:00Z'));
    expect(where.status).toBe('PUBLISHED');
    expect(where.AND).toEqual([
      { OR: [{ deadline: null }, { deadline: { gte: new Date('2026-11-02T00:00:00Z') } }] },
      { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date('2026-11-02T18:30:00Z') } }] },
    ]);
  });
});
