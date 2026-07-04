import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Beleqet database...');

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12)
      throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN', isActive: true },
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        firstName: process.env.ADMIN_FIRST_NAME || 'Platform',
        lastName: process.env.ADMIN_LAST_NAME || 'Admin',
        role: 'ADMIN',
        emailVerified: true,
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
    update: {},
    create: {
      email: 'employer@beleqet.demo',
      passwordHash: await bcrypt.hash('Password123!', 10),
      firstName: 'Beleqet',
      lastName: 'Employer',
      role: 'EMPLOYER',
      emailVerified: true,
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

  console.log('\n🎉 Database seeded successfully with Production Categories!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
