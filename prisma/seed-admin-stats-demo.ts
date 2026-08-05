/**
 * Demo data for Admin Stats dashboard visibility.
 * Safe fake users (no real PII). Run after main seed:
 *
 *   npx ts-node --transpile-only prisma/seed-admin-stats-demo.ts
 *
 * Idempotent: deletes previous rows tagged with email domain @demo.beleqet.local
 */
import { PrismaClient, FreelanceJobStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const DEMO_DOMAIN = 'demo.beleqet.local';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DemoPassword!234';

const FIRST_NAMES = [
  'Abebe',
  'Sara',
  'Lemlem',
  'Hana',
  'Kirubel',
  'Yonas',
  'Marta',
  'Tigist',
  'Dawit',
  'Selam',
  'Bereket',
  'Rahel',
];

const PROJECT_TITLES = [
  'Mobile banking UI kit',
  'API integration for logistics',
  'Amharic content rewrite',
  'Landing page redesign',
  'Data cleanup script',
  'Telegram bot for support',
  'Payroll spreadsheet automation',
  'Storefront product photos',
  'SEO audit for jobs portal',
  'Contract PDF generator',
  'Interview scheduling widget',
  'KYC document checklist',
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  console.log('Seeding Admin Stats demo data…');

  if (DEMO_PASSWORD.length < 12) {
    throw new Error('DEMO_USER_PASSWORD must be at least 12 characters');
  }

  const existingDemo = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  const demoIds = existingDemo.map((u) => u.id);
  if (demoIds.length > 0) {
    const demoJobs = await prisma.freelanceJob.findMany({
      where: { clientId: { in: demoIds } },
      select: { id: true },
    });
    const jobIds = demoJobs.map((j) => j.id);
    if (jobIds.length > 0) {
      await prisma.escrowTransaction.deleteMany({ where: { freelanceJobId: { in: jobIds } } });
      await prisma.dispute.deleteMany({
        where: { contract: { freelanceJobId: { in: jobIds } } },
      });
      await prisma.contract.deleteMany({ where: { freelanceJobId: { in: jobIds } } });
      await prisma.bid.deleteMany({ where: { freelanceJobId: { in: jobIds } } });
      await prisma.freelanceJob.deleteMany({ where: { id: { in: jobIds } } });
    }
    await prisma.payment.deleteMany({ where: { userId: { in: demoIds } } });
    await prisma.bid.deleteMany({ where: { freelancerId: { in: demoIds } } });
    await prisma.user.deleteMany({ where: { id: { in: demoIds } } });
  }

  const category = await prisma.freelanceCategory.upsert({
    where: { slug: 'web-development' },
    update: {},
    create: { slug: 'web-development', label: 'Web Development', icon: 'code-2' },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const roles: UserRole[] = [
    'EMPLOYER',
    'EMPLOYER',
    'FREELANCER',
    'FREELANCER',
    'FREELANCER',
    'JOB_SEEKER',
    'JOB_SEEKER',
    'JOB_SEEKER',
    'EMPLOYER',
    'FREELANCER',
    'JOB_SEEKER',
    'FREELANCER',
  ];

  const users = [];
  for (let i = 0; i < roles.length; i++) {
    const createdAt = daysAgo(40 - i * 3);
    const lastLoginAt = i % 4 === 0 ? null : daysAgo(i % 20);
    const user = await prisma.user.create({
      data: {
        email: `demo.user.${i + 1}@${DEMO_DOMAIN}`,
        passwordHash,
        firstName: pick(FIRST_NAMES, i),
        lastName: 'Demo',
        role: roles[i],
        emailVerified: i % 3 !== 0,
        isActive: i !== 5,
        lastLoginAt,
        createdAt,
        updatedAt: createdAt,
      },
    });
    users.push(user);
  }

  const employers = users.filter((u) => u.role === 'EMPLOYER');
  const freelancers = users.filter((u) => u.role === 'FREELANCER');
  const statuses: FreelanceJobStatus[] = [
    'DRAFT',
    'FUNDED',
    'OPEN',
    'OPEN',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
    'OPEN',
  ];

  const jobs = [];
  for (let i = 0; i < PROJECT_TITLES.length; i++) {
    const client = pick(employers, i);
    const createdAt = daysAgo(28 - i * 2);
    const job = await prisma.freelanceJob.create({
      data: {
        title: PROJECT_TITLES[i],
        description: `Demo freelance project #${i + 1} for admin dashboard charts.`,
        categoryId: category.id,
        clientId: client.id,
        budgetMin: 2000 + i * 500,
        budgetMax: 5000 + i * 800,
        currency: 'ETB',
        pricingType: 'FIXED',
        deadlineDays: 14 + (i % 10),
        skills: ['TypeScript', 'NestJS'],
        status: statuses[i],
        createdAt,
        updatedAt: createdAt,
      },
    });
    jobs.push(job);
  }

  for (let i = 0; i < 8; i++) {
    const job = jobs[i + 2];
    const freelancer = pick(freelancers, i);
    await prisma.bid.create({
      data: {
        freelanceJobId: job.id,
        freelancerId: freelancer.id,
        amount: job.budgetMin + 200,
        timelineDays: 10,
        coverLetter: 'Demo bid for admin stats visibility.',
        status: i % 3 === 0 ? 'ACCEPTED' : 'PENDING',
        createdAt: daysAgo(20 - i),
      },
    }).catch(() => undefined);
  }

  for (let i = 0; i < 6; i++) {
    const job = jobs.find((j) => j.status === 'IN_PROGRESS' || j.status === 'COMPLETED') || jobs[4];
    const client = employers[i % employers.length];
    const freelancer = freelancers[i % freelancers.length];
    const createdAt = daysAgo(18 - i * 2);
    const released = i % 2 === 0;
    const gross = 10000 + i * 2500;
    const fee = Math.round(gross * 0.1);

    const existing = await prisma.contract.findUnique({ where: { freelanceJobId: job.id } });
    if (existing) continue;

    await prisma.contract.create({
      data: {
        freelanceJobId: job.id,
        clientId: client.id,
        freelancerId: freelancer.id,
        agreedAmount: gross,
        currency: 'ETB',
        status: released ? 'COMPLETED' : 'ACTIVE',
        startedAt: createdAt,
        completedAt: released ? daysAgo(5 - i) : null,
      },
    });

    await prisma.escrowTransaction.create({
      data: {
        freelanceJobId: job.id,
        grossAmount: gross,
        platformFee: fee,
        netAmount: gross - fee,
        currency: 'ETB',
        status: released ? 'RELEASED' : 'FUNDED',
        fundedAt: createdAt,
        releasedAt: released ? daysAgo(4 - (i % 4)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // Spread platform fee recognition across recent days for the revenue chart
  for (let day = 1; day <= 25; day++) {
    if (day % 3 !== 0) continue;
    const client = employers[day % employers.length];
    const freelancer = freelancers[day % freelancers.length];
    const title = `Chart filler project ${day}`;
    const createdAt = daysAgo(day);
    const gross = 3000 + day * 120;
    const fee = Math.round(gross * 0.1);
    const job = await prisma.freelanceJob.create({
      data: {
        title,
        description: 'Synthetic escrow release for daily revenue series.',
        categoryId: category.id,
        clientId: client.id,
        budgetMin: gross - 500,
        budgetMax: gross,
        currency: 'ETB',
        pricingType: 'FIXED',
        deadlineDays: 7,
        skills: ['Demo'],
        status: 'COMPLETED',
        createdAt,
        updatedAt: createdAt,
      },
    });
    await prisma.contract.create({
      data: {
        freelanceJobId: job.id,
        clientId: client.id,
        freelancerId: freelancer.id,
        agreedAmount: gross,
        currency: 'ETB',
        status: 'COMPLETED',
        startedAt: createdAt,
        completedAt: createdAt,
      },
    });
    await prisma.escrowTransaction.create({
      data: {
        freelanceJobId: job.id,
        grossAmount: gross,
        platformFee: fee,
        netAmount: gross - fee,
        currency: 'ETB',
        status: 'RELEASED',
        fundedAt: createdAt,
        releasedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  for (let i = 0; i < 5; i++) {
    await prisma.payment.create({
      data: {
        userId: users[i].id,
        provider: 'STRIPE',
        providerPaymentId: `demo_pay_${randomUUID()}`,
        amount: (50 + i * 10) * 100,
        currency: 'USD',
        status: i === 4 ? 'FAILED' : 'SUCCEEDED',
        description: 'Demo gateway payment',
        createdAt: daysAgo(10 - i),
      },
    });
  }

  console.log(`Created ${users.length} demo users (@${DEMO_DOMAIN})`);
  console.log('Created freelance jobs, bids, contracts, escrow releases, and payments');
  console.log('Open /admin/dashboard as ADMIN to inspect the charts');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
