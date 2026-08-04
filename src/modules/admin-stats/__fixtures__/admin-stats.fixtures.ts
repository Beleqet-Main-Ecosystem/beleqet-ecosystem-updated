/**
 * Deterministic fake-data fixtures for Phase 4 manual + automated verification.
 * Expected totals are computed here so humans and tests share one source of truth.
 */

export const ADMIN_STATS_FIXTURES = {
  users: [
    { id: 'u-admin', role: 'ADMIN', lastLoginAt: '2026-08-03T10:00:00.000Z', createdAt: '2026-01-01' },
    { id: 'u-active-1', role: 'FREELANCER', lastLoginAt: '2026-08-02T10:00:00.000Z', createdAt: '2026-07-01' },
    { id: 'u-active-2', role: 'EMPLOYER', lastLoginAt: '2026-07-20T10:00:00.000Z', createdAt: '2026-06-01' },
    { id: 'u-inactive', role: 'JOB_SEEKER', lastLoginAt: null, createdAt: '2026-05-01' },
    { id: 'u-old', role: 'FREELANCER', lastLoginAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-15' },
  ],
  projects: [
    { id: 'p1', title: 'Draft logo', status: 'DRAFT', ownerFirstName: 'Abebe', createdAt: '2026-08-04' },
    { id: 'p2', title: 'Open API', status: 'OPEN', ownerFirstName: 'Sara', createdAt: '2026-08-03' },
    { id: 'p3', title: 'In progress app', status: 'IN_PROGRESS', ownerFirstName: 'Lem', createdAt: '2026-08-02' },
    { id: 'p4', title: 'Done site', status: 'COMPLETED', ownerFirstName: 'Hana', createdAt: '2026-07-01' },
    { id: 'p5', title: 'Cancelled gig', status: 'CANCELLED', ownerFirstName: 'Kirubel', createdAt: '2026-06-01' },
  ],
  /** Platform fee rows recognized in August 2026 (UTC). */
  augustFees: [
    { amount: 100, currency: 'ETB', at: '2026-08-01T12:00:00.000Z' },
    { amount: 250, currency: 'ETB', at: '2026-08-03T12:00:00.000Z' },
  ],
  /** July 2026 fees for MoM comparison. */
  julyFees: [{ amount: 200, currency: 'ETB', at: '2026-07-15T12:00:00.000Z' }],
} as const;

/** As-of 2026-08-04: rolling 30d active window starts ~2026-07-05. */
export const EXPECTED_FROM_FIXTURES = {
  totalUsers: 5,
  /** lastLoginAt in last 30 days relative to 2026-08-04: admin, active-1, active-2 */
  activeUsers30d: 3,
  totalProjects: 5,
  /** not COMPLETED/CANCELLED → DRAFT, OPEN, IN_PROGRESS */
  activeProjects: 3,
  revenueThisMonthAugust: 350,
  revenueLastMonthJuly: 200,
  /** ((350-200)/200)*100 */
  momPercentChange: 75,
  statusCounts: {
    DRAFT: 1,
    FUNDED: 0,
    OPEN: 1,
    IN_PROGRESS: 1,
    COMPLETED: 1,
    CANCELLED: 1,
  },
  revenueChartAug1to4: [
    { date: '2026-08-01', revenue: 100 },
    { date: '2026-08-02', revenue: 0 },
    { date: '2026-08-03', revenue: 250 },
    { date: '2026-08-04', revenue: 0 },
  ],
} as const;
