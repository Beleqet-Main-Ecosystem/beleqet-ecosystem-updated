import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Beleqet database...');

  console.log('🛡️ Seeding RBAC permissions and roles...');
  const permissionsData = [
    { action: 'manage:roles', description: 'Manage roles and permissions' },
    { action: 'manage:users', description: 'Manage user accounts' },
    { action: 'manage:jobs', description: 'Manage all jobs' },
    { action: 'create:jobs', description: 'Create and post jobs' },
    { action: 'view:stats', description: 'View platform statistics' },
    { action: 'manage:billing', description: 'Manage subscriptions and billing' },
    { action: 'manage:kyc', description: 'Manage KYC verification' },
    { action: 'manage:disputes', description: 'Manage contracts and disputes' },
    { action: 'manage:db', description: 'Manage database indexing' },
  ];

  const permissions = await Promise.all(
    permissionsData.map(p => prisma.permission.upsert({
      where: { action: p.action },
      update: {},
      create: p,
    }))
  );
  
  const permMap = Object.fromEntries(permissions.map(p => [p.action, { id: p.id }]));

  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Super Administrator',
      isSystem: true,
      permissions: { connect: Object.values(permMap) },
    }
  });

  await prisma.role.upsert({
    where: { name: 'EMPLOYER' },
    update: {},
    create: {
      name: 'EMPLOYER',
      description: 'Employer who posts jobs',
      isSystem: true,
      permissions: { connect: [permMap['create:jobs'], permMap['manage:disputes']] },
    }
  });

  await prisma.role.upsert({
    where: { name: 'FREELANCER' },
    update: {},
    create: {
      name: 'FREELANCER',
      description: 'Freelancer providing services',
      isSystem: true,
      permissions: { connect: [permMap['manage:disputes']] },
    }
  });
  console.log('✅ RBAC initialization complete');

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12)
      throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN', isActive: true, rbacRoles: { connect: { name: 'ADMIN' } } },
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        firstName: process.env.ADMIN_FIRST_NAME || 'Platform',
        lastName: process.env.ADMIN_LAST_NAME || 'Admin',
        role: 'ADMIN',
        emailVerified: true,
        rbacRoles: { connect: { name: 'ADMIN' } },
      },
    });
    console.log('✅ Environment-configured admin created');
  } else {
    console.log('ℹ️  ADMIN_EMAIL/ADMIN_PASSWORD not set; admin seed skipped');
  }

  // ── Job Categories ─────────────────────────────────────────────────────────
  const rawJobCategories = [
    'Accounting And Finance',
    'Advisory And Consultancy',
    'Aeronautics And Aerospace',
    'Agriculture',
    'Architecture And Urban Planning',
    'Beauty And Grooming',
    'Broker And Case Closer',
    'Business And Commerce',
    'Chemical And Biomedical Engineering',
    'Clothing And Textile',
    'Construction And Civil Engineering',
    'Creative Art And Design',
    'Customer Service And Care',
    'Data Mining And Analytics',
    'Documentation And Writing Services',
    'Entertainment',
    'Environmental And Energy Engineering',
    'Event Management And Organization',
    'Fashion Design',
    'Food And Drink Preparation Or Service',
    'Gardening And Landscaping',
    'Health Care',
    'Horticulture',
    'Hospitality And Tourism',
    'Human Resource And Talent Management',
    'Information Technology',
    'Installation And Maintenance Technician',
    'Janitorial And Other Office Services',
    'Labor Work And Masonry',
    'Law',
    'Livestock And Animal Husbandry',
    'Logistic And Supply Chain',
    'Manufacturing And Production',
    'Marketing And Advertisement',
    'Mechanical And Electrical Engineering',
    'Media And Communication',
    'Multimedia Content Production',
    'Pharmaceutical',
    'Project Management And Administration',
    'Psychiatry, Psychology And Social Work',
    'Purchasing And Procurement',
    'Research And Data Analytics',
    'Sales And Promotion',
    'Secretarial And Office Management',
    'Security And Safety',
    'Shop And Office Attendant',
    'Software Design And Development',
    'Teaching And Tutor',
    'Training And Consultancy',
    'Training And Mentorship',
    'Translation And Transcription',
    'Transportation',
    'Transportation And Delivery',
    'Veterinary',
    'Woodwork And Carpentry',
  ];

  const categories = await Promise.all(
    rawJobCategories.map((cat) => {
      const slug = cat.toLowerCase().replace(/[, ]+/g, '-').replace(/-+$/g, '');
      return prisma.jobCategory.upsert({
        where: { slug },
        update: {},
        create: { slug, label: cat, icon: 'briefcase' }, // generic icon as default
      });
    }),
  );
  console.log('✅ Job categories created');

  // ── Freelance Categories ───────────────────────────────────────────────────
  await Promise.all([
    prisma.freelanceCategory.upsert({
      where: { slug: 'graphic-design' },
      update: {},
      create: { slug: 'graphic-design', label: 'Graphic Design', icon: 'palette' },
    }),
    prisma.freelanceCategory.upsert({
      where: { slug: 'web-development' },
      update: {},
      create: { slug: 'web-development', label: 'Web Development', icon: 'code-2' },
    }),
    prisma.freelanceCategory.upsert({
      where: { slug: 'digital-marketing' },
      update: {},
      create: { slug: 'digital-marketing', label: 'Digital Marketing', icon: 'megaphone' },
    }),
    prisma.freelanceCategory.upsert({
      where: { slug: 'video-animation' },
      update: {},
      create: { slug: 'video-animation', label: 'Video & Animation', icon: 'clapperboard' },
    }),
    prisma.freelanceCategory.upsert({
      where: { slug: 'writing' },
      update: {},
      create: { slug: 'writing', label: 'Writing & Translation', icon: 'pen-line' },
    }),
  ]);
  console.log('✅ Freelance categories created');

  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const employer = await prisma.user.upsert({
    where: { email: 'employer@beleqet.demo' },
    update: { rbacRoles: { connect: { name: 'EMPLOYER' } } },
    create: {
      email: 'employer@beleqet.demo',
      passwordHash: await bcrypt.hash('Password123!', 10),
      firstName: 'Beleqet',
      lastName: 'Employer',
      role: 'EMPLOYER',
      emailVerified: true,
      rbacRoles: { connect: { name: 'EMPLOYER' } },
    },
  });

  const company = await prisma.company.upsert({
    where: { userId: employer.id },
    update: {},
    create: {
      userId: employer.id,
      name: 'Beleqet Talent Network',
      description: 'Connecting Ethiopian employers with verified talent across the country.',
      location: 'Addis Ababa',
      verified: true,
    },
  });

  const demoJobs: {
    id: string;
    title: string;
    slug: string;
    location: string;
    type: string;
    featured: boolean;
    tags: string[];
    companyName: string;
    description: string;
  }[] = [
    {
      id: '11111111-1111-1111-1111-111111111101',
      title: 'Full Stack Developer',
      slug: 'software-design-and-development',
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      featured: true,
      tags: ['React', 'Node.js', 'PostgreSQL'],
      companyName: 'TakaCash',
      description:
        'Build and maintain customer-facing fintech products across a Next.js front end and Node services, shipping features end to end with product and design.',
    },
    {
      id: '11111111-1111-1111-1111-111111111102',
      title: 'Digital Marketing Specialist',
      slug: 'marketing-and-advertisement',
      location: 'Addis Ababa',
      type: 'HYBRID',
      featured: true,
      tags: ['SEO', 'Paid Ads', 'Content'],
      companyName: 'ethio telecom',
      description:
        'Plan and execute digital campaigns across search, social, and Telegram channels, owning performance reporting and qualified lead growth.',
    },
    {
      id: '11111111-1111-1111-1111-111111111103',
      title: 'Customer Service Agent',
      slug: 'customer-service-and-care',
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      featured: true,
      tags: ['Customer Care', 'Banking'],
      companyName: 'Dashen Bank',
      description:
        'Handle customer inquiries across branch and digital channels, resolve account issues, and maintain service standards.',
    },
    {
      id: '11111111-1111-1111-1111-111111111104',
      title: 'Graphic Designer',
      slug: 'creative-art-and-design',
      location: 'Remote',
      type: 'REMOTE',
      featured: true,
      tags: ['Figma', 'Branding'],
      companyName: 'System One',
      description:
        'Design marketing assets, social creatives, and brand collateral for a fast-moving product team. Portfolio required.',
    },
    {
      id: '11111111-1111-1111-1111-111111111105',
      title: 'Senior Accountant',
      slug: 'accounting-and-finance',
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      featured: true,
      tags: ['Accounting', 'Finance'],
      companyName: 'BN Star Trading Plc.',
      description:
        'Manage the general ledger, monthly closing, and financial reporting for a growing trading company.',
    },
    {
      id: '11111111-1111-1111-1111-111111111106',
      title: 'IT Support Officer',
      slug: 'information-technology',
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      featured: false,
      tags: ['Networking', 'Support'],
      companyName: 'Zemen Bank',
      description:
        'Provide first-line IT support, maintain workstations and networks, and resolve incidents across the head office.',
    },
    {
      id: '11111111-1111-1111-1111-111111111107',
      title: 'HR & Admin Officer',
      slug: 'human-resource-and-talent-management',
      location: 'Addis Ababa',
      type: 'FULL_TIME',
      featured: false,
      tags: ['HR', 'Operations'],
      companyName: 'Safaricom Ethiopia',
      description:
        'Support recruitment, onboarding, and day-to-day HR administration for the Addis Ababa office.',
    },
    {
      id: '11111111-1111-1111-1111-111111111108',
      title: 'Frontend Engineer',
      slug: 'software-design-and-development',
      location: 'Remote',
      type: 'CONTRACT',
      featured: false,
      tags: ['Next.js', 'TypeScript', 'Tailwind'],
      companyName: 'Beleqet Talent Network',
      description:
        'Build responsive, accessible interfaces in Next.js and TypeScript, collaborating with designers on a component-driven design system.',
    },
  ];

  await Promise.all(
    demoJobs.map((j) =>
      prisma.job.upsert({
        where: { id: j.id },
        update: {},
        create: {
          id: j.id,
          title: j.title,
          description: j.description,
          location: j.location,
          type: j.type as never,
          featured: j.featured,
          tags: j.tags,
          companyName: j.companyName,
          status: 'PUBLISHED',
          categoryId: bySlug[j.slug],
          companyId: company.id,
        },
      }),
    ),
  );
  console.log('✅ Demo jobs created');

  // ── Subscription Plans ─────────────────────────────────────────────────────
  await Promise.all([
    prisma.plan.upsert({
      where: { name: 'Free' },
      update: {},
      create: {
        name: 'Free',
        description: 'Get started with the basics — no cost, no card required.',
        priceAmount: 0,
        currency: 'ETB',
        interval: 'MONTHLY',
        features: { maxJobPosts: 1, maxFreelanceBids: 3, support: 'community' },
        isActive: true,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Pro' },
      update: {},
      create: {
        name: 'Pro',
        description: 'For active job seekers and freelancers who want priority visibility.',
        priceAmount: 99900,
        currency: 'ETB',
        interval: 'MONTHLY',
        features: { maxJobPosts: 10, maxFreelanceBids: 50, support: 'email', featuredListing: true },
        isActive: true,
        // Set to a real PayPal billing plan id (created on the PayPal dashboard)
        // before this plan is checkout-able — see PlansController PATCH /plans/:id.
        paypalPlanId: null,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Enterprise' },
      update: {},
      create: {
        name: 'Enterprise',
        description: 'For companies hiring at scale, with dedicated support.',
        priceAmount: 499900,
        currency: 'ETB',
        interval: 'MONTHLY',
        features: {
          maxJobPosts: -1,
          maxFreelanceBids: -1,
          support: 'dedicated',
          featuredListing: true,
          apiAccess: true,
        },
        isActive: true,
        paypalPlanId: null,
      },
    }),
  ]);
  console.log('✅ Subscription plans created (Free/Pro/Enterprise)');

  // ── FAQ Bot Knowledge Base ─────────────────────────────────────────────────
  await seedFaqKnowledge();
  console.log('✅ FAQ Bot knowledge base seeded');

  // ── Campaigns / Ad Events (boost) ──────────────────────────────────────────
  await seedCampaigns(employer.id, demoJobs[0].id);
  console.log('✅ Campaigns and synthetic ad_events seeded');

  console.log('\n🎉 Database seeded successfully with Production Categories!');
}

/**
 * Seeds demo campaigns across JOB / PROPOSAL / GIG targets plus synthetic
 * append-only ad_events for dashboard testing. Money amounts are minor units.
 */
async function seedCampaigns(ownerId: string, jobTargetId: string) {
  const createHash = (await import('crypto')).createHash;
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');

  const freelanceCategory = await prisma.freelanceCategory.upsert({
    where: { slug: 'web-development' },
    update: {},
    create: {
      slug: 'web-development',
      label: 'Web Development',
      icon: 'code',
    },
  });

  const gig = await prisma.freelanceJob.upsert({
    where: { id: '22222222-2222-2222-2222-222222222201' },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222201',
      title: 'Build a Next.js landing page',
      description: 'Responsive marketing landing page with CMS hooks for Beleqet demos.',
      budgetMin: 500000,
      budgetMax: 1500000,
      currency: 'ETB',
      deadlineDays: 14,
      skills: ['Next.js', 'TypeScript', 'Tailwind'],
      status: 'OPEN',
      clientId: ownerId,
      categoryId: freelanceCategory.id,
    },
  });

  const freelancer = await prisma.user.upsert({
    where: { email: 'demo.freelancer@beleqet.com' },
    update: {},
    create: {
      email: 'demo.freelancer@beleqet.com',
      passwordHash: await bcrypt.hash('DemoFreelancer123!', 12),
      firstName: 'Demo',
      lastName: 'Freelancer',
      role: 'FREELANCER',
      emailVerified: true,
      rbacRoles: { connect: { name: 'FREELANCER' } },
    },
  });

  const proposal = await prisma.bid.upsert({
    where: {
      freelanceJobId_freelancerId: {
        freelanceJobId: gig.id,
        freelancerId: freelancer.id,
      },
    },
    update: {},
    create: {
      id: '33333333-3333-3333-3333-333333333301',
      freelanceJobId: gig.id,
      freelancerId: freelancer.id,
      amount: 900000,
      timelineDays: 14,
      coverLetter: 'I can deliver a polished Next.js landing page with analytics hooks.',
      status: 'PENDING',
    },
  });

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const campaigns = [
    {
      id: '44444444-4444-4444-4444-444444444401',
      ownerId,
      targetType: 'JOB' as const,
      targetId: jobTargetId,
      status: 'ACTIVE' as const,
      bidModel: 'CPC' as const,
      bidAmount: 50,
      dailyBudgetCap: 5000,
      totalBudget: 50000,
      spentAmount: 1250,
      currencyCode: 'ETB',
      startAt: new Date(now.getTime() - 3 * dayMs),
      endAt: new Date(now.getTime() + 27 * dayMs),
    },
    {
      id: '44444444-4444-4444-4444-444444444402',
      ownerId,
      targetType: 'GIG' as const,
      targetId: gig.id,
      status: 'ACTIVE' as const,
      bidModel: 'CPM' as const,
      bidAmount: 200,
      dailyBudgetCap: 8000,
      totalBudget: 80000,
      spentAmount: 3200,
      currencyCode: 'ETB',
      startAt: new Date(now.getTime() - 2 * dayMs),
      endAt: new Date(now.getTime() + 12 * dayMs),
    },
    {
      id: '44444444-4444-4444-4444-444444444403',
      ownerId: freelancer.id,
      targetType: 'PROPOSAL' as const,
      targetId: proposal.id,
      status: 'PAUSED' as const,
      bidModel: 'CPC' as const,
      bidAmount: 75,
      dailyBudgetCap: 3000,
      totalBudget: 20000,
      spentAmount: 450,
      currencyCode: 'ETB',
      startAt: new Date(now.getTime() - 5 * dayMs),
      endAt: new Date(now.getTime() + 10 * dayMs),
    },
    {
      id: '44444444-4444-4444-4444-444444444404',
      ownerId,
      targetType: 'JOB' as const,
      targetId: jobTargetId,
      status: 'DRAFT' as const,
      bidModel: 'CPC' as const,
      bidAmount: 40,
      dailyBudgetCap: 2000,
      totalBudget: 10000,
      spentAmount: 0,
      currencyCode: 'ETB',
      startAt: null,
      endAt: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444405',
      ownerId,
      targetType: 'GIG' as const,
      targetId: gig.id,
      status: 'EXHAUSTED' as const,
      bidModel: 'CPM' as const,
      bidAmount: 150,
      dailyBudgetCap: 4000,
      totalBudget: 4000,
      spentAmount: 4000,
      currencyCode: 'ETB',
      startAt: new Date(now.getTime() - 14 * dayMs),
      endAt: new Date(now.getTime() - 1 * dayMs),
    },
  ];

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: {},
      create: campaign,
    });
  }

  // Wipe prior synthetic events for these campaigns so re-seed stays idempotent.
  await prisma.adEvent.deleteMany({
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
  });

  const eventCampaignIds = campaigns
    .filter((c) => c.status === 'ACTIVE' || c.status === 'EXHAUSTED' || c.status === 'PAUSED')
    .map((c) => c.id);

  const events: {
    campaignId: string;
    eventType: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
    occurredAt: Date;
    hashedIp: string;
    hashedUserAgent: string;
    sessionRef: string;
  }[] = [];

  for (const campaignId of eventCampaignIds) {
    for (let i = 0; i < 40; i++) {
      const occurredAt = new Date(now.getTime() - Math.floor(Math.random() * 7 * dayMs));
      const sessionRef = `sess_${hash(`session-${campaignId}-${Math.floor(i / 5)}`).slice(0, 16)}`;
      events.push({
        campaignId,
        eventType: 'IMPRESSION',
        occurredAt,
        hashedIp: hash(`10.0.${i % 50}.${i % 200}`),
        hashedUserAgent: hash(`Mozilla/5.0 demo-agent/${i % 7}`),
        sessionRef,
      });
      if (i % 5 === 0) {
        events.push({
          campaignId,
          eventType: 'CLICK',
          occurredAt: new Date(occurredAt.getTime() + 1000),
          hashedIp: hash(`10.0.${i % 50}.${i % 200}`),
          hashedUserAgent: hash(`Mozilla/5.0 demo-agent/${i % 7}`),
          sessionRef,
        });
      }
      if (i % 15 === 0) {
        events.push({
          campaignId,
          eventType: 'CONVERSION',
          occurredAt: new Date(occurredAt.getTime() + 5000),
          hashedIp: hash(`10.0.${i % 50}.${i % 200}`),
          hashedUserAgent: hash(`Mozilla/5.0 demo-agent/${i % 7}`),
          sessionRef,
        });
      }
    }
  }

  await prisma.adEvent.createMany({ data: events });
}

async function seedFaqKnowledge() {
  const OpenAI = (await import('openai')).default;
  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  const { FAQ_KNOWLEDGE_SEED } = await import('./faq-seed-data');

  for (const entry of FAQ_KNOWLEDGE_SEED) {
    let embedding: number[] | undefined;
    if (openai) {
      try {
        const text = `${entry.questionEn}\n${entry.answerEn}`;
        const response = await openai.embeddings.create({ model: embeddingModel, input: text });
        embedding = response.data[0]?.embedding;
      } catch {
        embedding = undefined;
      }
    }

    await prisma.faqKnowledgeEntry.upsert({
      where: { slug: entry.slug },
      update: {
        category: entry.category,
        questionEn: entry.questionEn,
        questionAm: entry.questionAm,
        answerEn: entry.answerEn,
        answerAm: entry.answerAm,
        keywords: [...entry.keywords],
        currency: 'currency' in entry ? entry.currency : null,
        embedding: embedding ?? undefined,
        isPublished: true,
      },
      create: {
        slug: entry.slug,
        category: entry.category,
        questionEn: entry.questionEn,
        questionAm: entry.questionAm,
        answerEn: entry.answerEn,
        answerAm: entry.answerAm,
        keywords: [...entry.keywords],
        currency: 'currency' in entry ? entry.currency : null,
        embedding: embedding ?? undefined,
        isPublished: true,
      },
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
