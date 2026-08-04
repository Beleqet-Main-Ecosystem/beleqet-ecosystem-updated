#!/usr/bin/env npx ts-node
/**
 * Phase 4 manual verification helper.
 *
 * Prints the shared fixture calculator expectations, then (if DATABASE_URL
 * is reachable) optionally compares live AdminStatsService aggregates.
 *
 * Usage:
 *   npx ts-node --transpile-only tools/admin-stats-manual-verify.ts
 *   npx ts-node --transpile-only tools/admin-stats-manual-verify.ts --live
 */
import {
  ADMIN_STATS_FIXTURES,
  EXPECTED_FROM_FIXTURES,
} from '../src/modules/admin-stats/__fixtures__/admin-stats.fixtures';

function printFixtureChecklist(): void {
  console.log('=== Admin Stats Phase 4 — Fixture Calculator ===\n');
  console.log(`Users in fixture: ${ADMIN_STATS_FIXTURES.users.length}`);
  console.log(`  Expected totalUsers:           ${EXPECTED_FROM_FIXTURES.totalUsers}`);
  console.log(`  Expected activeUsers (30d):    ${EXPECTED_FROM_FIXTURES.activeUsers30d}`);
  console.log(`Projects in fixture: ${ADMIN_STATS_FIXTURES.projects.length}`);
  console.log(`  Expected totalProjects:        ${EXPECTED_FROM_FIXTURES.totalProjects}`);
  console.log(`  Expected activeProjects:       ${EXPECTED_FROM_FIXTURES.activeProjects}`);
  console.log(`Revenue August fees: ${ADMIN_STATS_FIXTURES.augustFees.map((f) => f.amount).join(' + ')}`);
  console.log(`  Expected revenue this month:   ${EXPECTED_FROM_FIXTURES.revenueThisMonthAugust}`);
  console.log(`  Expected last month:           ${EXPECTED_FROM_FIXTURES.revenueLastMonthJuly}`);
  console.log(
    `  Expected MoM %:                 ${EXPECTED_FROM_FIXTURES.momPercentChange}  [((350-200)/200)*100]`,
  );
  console.log('Status counts:');
  for (const [status, count] of Object.entries(EXPECTED_FROM_FIXTURES.statusCounts)) {
    console.log(`  ${status.padEnd(12)} ${count}`);
  }
  console.log('\nRevenue chart Aug 1–4 (zeros required):');
  for (const point of EXPECTED_FROM_FIXTURES.revenueChartAug1to4) {
    console.log(`  ${point.date} → ${point.revenue}`);
  }

  console.log('\n=== Manual gate checklist ===');
  console.log('[ ] Login as JOB_SEEKER → GET /admin-stats/overview → 403 Forbidden');
  console.log('[ ] Login as EMPLOYER   → GET /admin-stats/overview → 403 Forbidden');
  console.log('[ ] Login as ADMIN+view:stats → overview/charts/breakdown → 200');
  console.log('[ ] Empty DB / empty month → cards show 0, not errors');
  console.log('[ ] Recent projects payload has ownerFirstName only (no email/phone)');
  console.log('[ ] CSV downloads return text/csv for admin only');
}

async function maybeLiveCompare(): Promise<void> {
  if (!process.argv.includes('--live')) return;

  console.log('\n=== Live compare (--live) ===');
  try {
    // Lazy require so fixture-only runs never need Prisma.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const totalUsers = await prisma.user.count();
    const totalProjects = await prisma.freelanceJob.count();
    const activeProjects = await prisma.freelanceJob.count({
      where: { status: { in: ['DRAFT', 'FUNDED', 'OPEN', 'IN_PROGRESS'] } },
    });
    console.log(`Live totalUsers:      ${totalUsers}`);
    console.log(`Live totalProjects:   ${totalProjects}`);
    console.log(`Live activeProjects:  ${activeProjects}`);
    console.log('(Compare against known seed / your calculator — not the fixture file.)');
    await prisma.$disconnect();
  } catch (err) {
    console.error('Live compare failed (is DATABASE_URL up?):', (err as Error).message);
    process.exitCode = 1;
  }
}

printFixtureChecklist();
void maybeLiveCompare();
