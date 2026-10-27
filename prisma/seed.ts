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

  // ── Demo Freelance Jobs ───────────────────────────────────────────────────
  const fCats = await prisma.freelanceCategory.findMany();
  const fCatBySlug = Object.fromEntries(fCats.map((c) => [c.slug, c.id]));

  const demoFreelanceJobs = [
    {
      id: '22222222-2222-2222-2222-222222222201',
      title: 'React Native Mobile App — Fintech MVP',
      description: 'Build a cross-platform fintech MVP in React Native with secure authentication, local state management, and real-time transaction history.',
      slug: 'web-development',
      budgetMin: 15000,
      budgetMax: 30000,
      deadlineDays: 30,
      skills: ['React Native', 'TypeScript', 'REST API', 'Tailwind'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222202',
      title: 'Next.js E-Commerce Storefront with Payment Gateway',
      description: 'Develop a modern responsive e-commerce web application using Next.js 14 and TailwindCSS, including cart checkout and Telebirr/Chapa payment integration.',
      slug: 'web-development',
      budgetMin: 20000,
      budgetMax: 45000,
      deadlineDays: 21,
      skills: ['Next.js', 'React', 'Chapa API', 'TailwindCSS'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222203',
      title: 'Complete Brand Identity & Logo Package for Coffee Exporter',
      description: 'Create a premium corporate visual identity including logo mark, typography guidelines, packaging mockups, and business stationery.',
      slug: 'graphic-design',
      budgetMin: 8000,
      budgetMax: 18000,
      deadlineDays: 14,
      skills: ['Figma', 'Illustrator', 'Branding', 'Packaging'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222204',
      title: 'UI/UX Mobile App Redesign in Figma',
      description: 'Design high-fidelity interactive Figma prototypes, component library, and user flows for an on-demand logistics mobile application.',
      slug: 'graphic-design',
      budgetMin: 12000,
      budgetMax: 22000,
      deadlineDays: 15,
      skills: ['Figma', 'Mobile UI', 'Design System', 'Prototyping'],
      featured: false,
    },
    {
      id: '22222222-2222-2222-2222-222222222205',
      title: 'English to Amharic Legal & Business Contract Translation',
      description: 'Accurate technical translation of commercial agreements, NDA contracts, and company bylaws from English to Amharic with legal terminology precision.',
      slug: 'writing',
      budgetMin: 5000,
      budgetMax: 10000,
      deadlineDays: 7,
      skills: ['Amharic', 'English', 'Legal Translation', 'Proofreading'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222206',
      title: 'Tech & Startup Blog Writer (Weekly Articles)',
      description: 'Write well-researched, SEO-optimized articles and technical guides exploring fintech, software development, and digital entrepreneurship in Ethiopia.',
      slug: 'writing',
      budgetMin: 6000,
      budgetMax: 12000,
      deadlineDays: 30,
      skills: ['SEO Writing', 'Copywriting', 'Tech Content', 'English'],
      featured: false,
    },
    {
      id: '22222222-2222-2222-2222-222222222207',
      title: 'Telegram Channel & TikTok Growth Specialist',
      description: 'Develop and execute an organic growth and engagement strategy for our Telegram announcement channel and official TikTok profile.',
      slug: 'digital-marketing',
      budgetMin: 7500,
      budgetMax: 15000,
      deadlineDays: 30,
      skills: ['Telegram Marketing', 'TikTok Ads', 'Content Strategy'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222208',
      title: 'Google Ads & Meta Performance Marketing Campaign',
      description: 'Set up, optimize, and manage conversion campaigns across Meta Ads Manager and Google Ads for our e-commerce product launch.',
      slug: 'digital-marketing',
      budgetMin: 10000,
      budgetMax: 20000,
      deadlineDays: 14,
      skills: ['Meta Ads', 'Google Ads', 'Analytics', 'Conversion Optimization'],
      featured: false,
    },
    {
      id: '22222222-2222-2222-2222-222222222209',
      title: '60-Second 2D Animated Explainer Video with Voiceover',
      description: 'Produce a professional 60-second animated explainer video covering scriptwriting, custom character animation, and background music integration.',
      slug: 'video-animation',
      budgetMin: 14000,
      budgetMax: 25000,
      deadlineDays: 10,
      skills: ['2D Animation', 'After Effects', 'Motion Graphics', 'Storyboarding'],
      featured: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222210',
      title: 'Short-Form Video Editor (Reels, TikTok & Shorts)',
      description: 'Edit high-retention short-form videos with dynamic captions, sound effects, transitions, and pacing designed for viral social media distribution.',
      slug: 'video-animation',
      budgetMin: 8000,
      budgetMax: 16000,
      deadlineDays: 20,
      skills: ['Premiere Pro', 'CapCut', 'Color Grading', 'Sound Design'],
      featured: false,
    },
  ];

  await Promise.all(
    demoFreelanceJobs.map((fj) => {
      const catId = fCatBySlug[fj.slug];
      if (!catId) return Promise.resolve();
      return prisma.freelanceJob.upsert({
        where: { id: fj.id },
        update: {},
        create: {
          id: fj.id,
          title: fj.title,
          description: fj.description,
          categoryId: catId,
          clientId: employer.id,
          budgetMin: fj.budgetMin,
          budgetMax: fj.budgetMax,
          currency: 'ETB',
          pricingType: 'FIXED',
          deadlineDays: fj.deadlineDays,
          skills: fj.skills,
          status: 'OPEN',
          featured: fj.featured,
        },
      });
    }),
  );
  console.log('✅ Demo freelance jobs created');

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

  console.log('\n🎉 Database seeded successfully with Production Categories!');

  // ── Fraud Detection Rules ────────────────────────────────────────────────
  await Promise.all([
    prisma.fraudRule.upsert({
      where: { id: 'frule-off-platform' },
      update: {},
      create: {
        id: 'frule-off-platform',
        name: 'Off-Platform Payment Detection',
        ruleType: 'OFF_PLATFORM_PAYMENT',
        severity: 'HIGH',
        enabled: true,
        config: {
          threshold: 30,
          patterns: ['phone', 'email', 'iban', 'crypto', 'paypal', 'bank transfer', 'telebirr', 'cbe birr', 'amole', 'm-pesa'],
        },
        i18nKey: 'fraud.alert.title.OFF_PLATFORM_PAYMENT',
      },
    }),
    prisma.fraudRule.upsert({
      where: { id: 'frule-fake-profile' },
      update: {},
      create: {
        id: 'frule-fake-profile',
        name: 'Fake Profile Detection',
        ruleType: 'FAKE_PROFILE',
        severity: 'MEDIUM',
        enabled: true,
        config: {
          maxUnverifiedSkills: 8,
          requireEmailVerification: true,
          requireSkillVerification: true,
        },
        i18nKey: 'fraud.alert.title.FAKE_PROFILE',
      },
    }),
    prisma.fraudRule.upsert({
      where: { id: 'frule-payment-anomaly' },
      update: {},
      create: {
        id: 'frule-payment-anomaly',
        name: 'Payment Anomaly Detection',
        ruleType: 'PAYMENT_ANOMALY',
        severity: 'HIGH',
        enabled: true,
        config: {
          zScoreThreshold: 2.5,
          minimumHistory: 3,
        },
        i18nKey: 'fraud.alert.title.PAYMENT_ANOMALY',
      },
    }),
    prisma.fraudRule.upsert({
      where: { id: 'frule-duplicate-listing' },
      update: {},
      create: {
        id: 'frule-duplicate-listing',
        name: 'Duplicate Listing Detection',
        ruleType: 'DUPLICATE_LISTING',
        severity: 'LOW',
        enabled: true,
        config: {
          similarityThreshold: 0.8,
          lookbackDays: 30,
        },
        i18nKey: 'fraud.alert.title.DUPLICATE_LISTING',
      },
    }),
  ]);

  console.log('✅ Fraud detection rules seeded');
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
