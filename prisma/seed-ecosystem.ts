import {
  PrismaClient,
  JobType,
  JobStatus,
  ApplicationStatus,
  UserRole,
  FreelanceJobStatus,
  BidStatus,
  ContractStatus,
  MilestoneStatus,
  FraudRuleType,
  FraudSeverity,
  FraudAlertStatus,
  SubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Comprehensive Ecosystem Seeder...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Fetch categories
  const jobCategories = await prisma.jobCategory.findMany();
  const catMap: Record<string, string> = {};
  for (const c of jobCategories) {
    catMap[c.slug] = c.id;
  }

  const freelanceCategories = await prisma.freelanceCategory.findMany();
  const fcatMap: Record<string, string> = {};
  for (const c of freelanceCategories) {
    fcatMap[c.slug] = c.id;
  }

  const planPro = await prisma.plan.findFirst({ where: { name: 'Pro' } });
  const planEnterprise = await prisma.plan.findFirst({ where: { name: 'Enterprise' } });

  // 2. Create Top Employer Accounts & Companies
  console.log('🏢 Creating Companies and Employers...');

  const employerData = [
    {
      email: 'careers@ethiotelecom.et',
      firstName: 'Frehiwot',
      lastName: 'Tamiru',
      company: {
        name: 'Ethio Telecom',
        description: 'The leading telecommunications services provider in Ethiopia, driving digital transformation nationwide.',
        website: 'https://www.ethiotelecom.et',
        location: 'Addis Ababa, Churchill Road',
        industry: 'Telecommunications',
        size: '10000+ employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1544654803-b69140b285a1?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'hr@cbe.com.et',
      firstName: 'Abe',
      lastName: 'Sano',
      company: {
        name: 'Commercial Bank of Ethiopia',
        description: 'The pioneer and largest commercial bank in Ethiopia with over 1,900 branches across the nation.',
        website: 'https://www.combanketh.et',
        location: 'Addis Ababa, Commercial Bank Tower',
        industry: 'Banking & Financial Services',
        size: '5000+ employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'talent@chapa.co',
      firstName: 'Nael',
      lastName: 'Hailemariam',
      company: {
        name: 'Chapa Financial Technologies',
        description: 'Payment gateway and fintech infrastructure empowering Ethiopian and African businesses to accept global payments.',
        website: 'https://chapa.co',
        location: 'Addis Ababa, Bole Medhanialem',
        industry: 'Fintech & Software',
        size: '50-100 employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'jobs@hybrid.et',
      firstName: 'Samrawit',
      lastName: 'Fikru',
      company: {
        name: 'RIDE / Hybrid Designs',
        description: 'Pioneering on-demand ride-hailing and transport platform connecting millions across urban Ethiopia.',
        website: 'https://ride8294.com',
        location: 'Addis Ababa, Kazanchis',
        industry: 'Transportation & Logistics',
        size: '200-500 employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'careers@gebeya.com',
      firstName: 'Amadou',
      lastName: 'Daffe',
      company: {
        name: 'Gebeya Inc.',
        description: 'Pan-African SaaS marketplace connecting vetted African tech talent and gig workers with global opportunities.',
        website: 'https://gebeya.com',
        location: 'Addis Ababa & Remote',
        industry: 'Software & Talent Marketplace',
        size: '100-250 employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'recruiting@dashenbanksc.com',
      firstName: 'Asfaw',
      lastName: 'Alemu',
      company: {
        name: 'Dashen Bank SC',
        description: 'One of the leading private banks in Ethiopia providing innovative digital and modern retail banking solutions.',
        website: 'https://dashenbanksc.com',
        location: 'Addis Ababa, Sudan Street',
        industry: 'Banking & Financial Services',
        size: '3000+ employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=128&h=128&fit=crop',
      },
    },
    {
      email: 'careers@deliveraddis.com',
      firstName: 'Feleg',
      lastName: 'Tsegaye',
      company: {
        name: 'Deliver Addis',
        description: 'Ethiopia premier online delivery service offering food, grocery, and e-commerce logistics.',
        website: 'https://deliveraddis.com',
        location: 'Addis Ababa, Sarbet',
        industry: 'E-commerce & Logistics',
        size: '100-200 employees',
        verified: true,
        logoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=128&h=128&fit=crop',
      },
    },
  ];

  const companies: { id: string; name: string; userId: string }[] = [];

  for (const emp of employerData) {
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: UserRole.EMPLOYER,
        emailVerified: true,
        rbacRoles: { connect: { name: 'EMPLOYER' } },
      },
    });

    const comp = await prisma.company.upsert({
      where: { userId: user.id },
      update: {
        name: emp.company.name,
        description: emp.company.description,
        website: emp.company.website,
        location: emp.company.location,
        industry: emp.company.industry,
        size: emp.company.size,
        verified: emp.company.verified,
        logoUrl: emp.company.logoUrl,
      },
      create: {
        userId: user.id,
        name: emp.company.name,
        description: emp.company.description,
        website: emp.company.website,
        location: emp.company.location,
        industry: emp.company.industry,
        size: emp.company.size,
        verified: emp.company.verified,
        logoUrl: emp.company.logoUrl,
      },
    });

    // Ensure employer wallet exists with funds
    await prisma.employerWallet.upsert({
      where: { userId: user.id },
      update: { balance: 2500000, lockedBalance: 50000 },
      create: {
        userId: user.id,
        balance: 2500000,
        lockedBalance: 50000,
        currency: 'ETB',
      },
    });

    // Add subscription if plan exists
    if (planEnterprise) {
      const existingSub = await prisma.subscription.findFirst({ where: { userId: user.id } });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: planEnterprise.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          },
        });
      }
    }

    companies.push({ id: comp.id, name: comp.name, userId: user.id });
  }

  console.log(`✅ ${companies.length} Companies & Employers seeded`);

  // 3. Create Job Seekers
  console.log('👤 Creating Job Seekers & Candidates...');

  const candidatesData = [
    { email: 'bethlehem.tadesse@beleqet.demo', firstName: 'Bethlehem', lastName: 'Tadesse' },
    { email: 'dawit.haile@beleqet.demo', firstName: 'Dawit', lastName: 'Haile' },
    { email: 'meron.assefa@beleqet.demo', firstName: 'Meron', lastName: 'Assefa' },
    { email: 'henok.getachew@beleqet.demo', firstName: 'Henok', lastName: 'Getachew' },
    { email: 'tigist.alemu@beleqet.demo', firstName: 'Tigist', lastName: 'Alemu' },
    { email: 'natnael.bekele@beleqet.demo', firstName: 'Natnael', lastName: 'Bekele' },
    { email: 'rahel.kebede@beleqet.demo', firstName: 'Rahel', lastName: 'Kebede' },
    { email: 'samuel.tefera@beleqet.demo', firstName: 'Samuel', lastName: 'Tefera' },
  ];

  const jobSeekers: { id: string; email: string; name: string }[] = [];

  for (const c of candidatesData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash,
        firstName: c.firstName,
        lastName: c.lastName,
        role: UserRole.JOB_SEEKER,
        emailVerified: true,
      },
    });

    jobSeekers.push({ id: user.id, email: user.email, name: `${c.firstName} ${c.lastName}` });
  }
  console.log(`✅ ${jobSeekers.length} Job Seekers seeded`);

  // 4. Create Rich Jobs Portfolio
  console.log('💼 Seeding 32+ Rich, Realistic Regular Jobs...');

  const defaultCategory = jobCategories[0]?.id || '';

  const jobsData = [
    {
      companyIndex: 2, // Chapa
      title: 'Senior Backend Engineer (Node.js & Go)',
      categorySlug: 'software-design-and-development',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa (Bole)',
      salaryMin: 65000,
      salaryMax: 110000,
      featured: true,
      tags: ['Node.js', 'Go', 'PostgreSQL', 'Redis', 'Microservices', 'Fintech'],
      experienceLevel: 'Senior (4+ years)',
      description: `Chapa is looking for a Senior Backend Engineer to architect, build, and optimize high-throughput financial settlement and payment orchestration services. You will join our core engineering group handling millions of transactions every month with 99.99% uptime requirements.`,
      requirements: `• 4+ years building production distributed systems with Node.js/TypeScript or Go\n• Solid understanding of relational database optimization, transactions, and indexing\n• Experience with queue architectures (BullMQ, Kafka, or RabbitMQ)\n• Passion for financial data integrity and security`,
    },
    {
      companyIndex: 2, // Chapa
      title: 'Lead Frontend Developer (React & Next.js)',
      categorySlug: 'software-design-and-development',
      type: JobType.HYBRID,
      location: 'Addis Ababa / Hybrid',
      salaryMin: 55000,
      salaryMax: 85000,
      featured: true,
      tags: ['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'WebSockets'],
      experienceLevel: 'Mid-Senior',
      description: `Join Chapa to lead the development of our merchant portal, checkout SDKs, and developer documentation surfaces. You will craft pixel-perfect, accessible, and fast web experiences for thousands of merchants and developers across Africa.`,
      requirements: `• 3+ years experience with Next.js (App Router), React, and TypeScript\n• Mastery of modern CSS and component systems (Tailwind, Radix UI)\n• Track record of shipping developer tools or dashboard interfaces`,
    },
    {
      companyIndex: 0, // Ethio Telecom
      title: 'Telecommunications Network Security Specialist',
      categorySlug: 'security-and-safety',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 45000,
      salaryMax: 75000,
      featured: true,
      tags: ['Cybersecurity', 'Firewalls', 'Cisco', 'SIEM', 'ISO27001'],
      experienceLevel: 'Senior',
      description: `Ethio Telecom is seeking an experienced Network Security Specialist to defend national core IP infrastructure, monitor SOC security telemetry, and ensure high resilience against state-of-the-art cyber threats.`,
      requirements: `• BSc in Computer Science, Telecommunications, or Information Security\n• Certifications like CISSP, CEH, or CCNP Security preferred\n• Hands-on proficiency with intrusion prevention and network packet analysis`,
    },
    {
      companyIndex: 0, // Ethio Telecom
      title: 'Senior Data Center System Administrator',
      categorySlug: 'information-technology',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 40000,
      salaryMax: 65000,
      featured: false,
      tags: ['Linux', 'Kubernetes', 'Storage', 'VMware', 'Disaster Recovery'],
      experienceLevel: 'Mid-Senior',
      description: `Oversee hyper-scale server infrastructure, SAN storage arrays, and private cloud orchestration supporting millions of Telebirr and mobile broadband users.`,
      requirements: `• Deep expertise in Red Hat Enterprise Linux and virtualization\n• Experience maintaining enterprise storage arrays (SAN/NAS) and automated backups`,
    },
    {
      companyIndex: 1, // CBE
      title: 'Senior Internal Auditor & Risk Assessor',
      categorySlug: 'accounting-and-finance',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa, Head Office',
      salaryMin: 38000,
      salaryMax: 60000,
      featured: true,
      tags: ['Internal Audit', 'IFRS', 'Financial Risk', 'Banking'],
      experienceLevel: 'Senior (5+ years)',
      description: `Conduct comprehensive audit evaluations across branch networks and digital banking channels to ensure complete compliance with National Bank of Ethiopia directives and IFRS guidelines.`,
      requirements: `• BA/MSc in Accounting, Finance, or related business discipline\n• Certified Internal Auditor (CIA) or ACCA is a major advantage\n• Minimum 5 years in financial services auditing`,
    },
    {
      companyIndex: 1, // CBE
      title: 'Core Banking Software Integration Specialist',
      categorySlug: 'software-design-and-development',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 50000,
      salaryMax: 85000,
      featured: true,
      tags: ['Core Banking', 'Java', 'Oracle PL/SQL', 'API Gateway', 'ISO8583'],
      experienceLevel: 'Senior',
      description: `Integrate core banking platforms with national switches (EthSwitch), mobile banking apps, and ATM terminals. High emphasis on fault tolerance and real-time ledger accounting.`,
      requirements: `• Extensive background in Java, Spring Boot, and Oracle database tuning\n• Hands-on familiarity with payment protocols (ISO 8583 / ISO 20022)\n• 4+ years banking integration experience`,
    },
    {
      companyIndex: 3, // RIDE
      title: 'Mobile App Developer (Flutter & Android)',
      categorySlug: 'software-design-and-development',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 45000,
      salaryMax: 80000,
      featured: true,
      tags: ['Flutter', 'Dart', 'Google Maps API', 'WebSockets', 'Geo-tracking'],
      experienceLevel: 'Mid-Senior',
      description: `Build and optimize rider and driver mobile applications used by hundreds of thousands of people every day. Focus on low-latency geolocation updates, battery efficiency, and seamless offline resilience.`,
      requirements: `• Proven apps published on Google Play or iOS App Store\n• Strong command of Flutter state management (Bloc / Riverpod)\n• Experience with background geolocation and push notifications`,
    },
    {
      companyIndex: 3, // RIDE
      title: 'Fleet Operations & Logistics Manager',
      categorySlug: 'logistic-and-supply-chain',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 35000,
      salaryMax: 55000,
      featured: false,
      tags: ['Fleet Management', 'Operations', 'Dispatch', 'Logistics'],
      experienceLevel: '3+ years',
      description: `Manage driver onboarding, quality control inspections, fleet partner coordination, and geographic vehicle allocation strategies throughout Addis Ababa and regional hubs.`,
      requirements: `• Degree in Logistics, Supply Chain, or Business Administration\n• Excellent negotiation and stakeholder management skills`,
    },
    {
      companyIndex: 4, // Gebeya
      title: 'AI & Machine Learning Engineer (NLP & Amharic)',
      categorySlug: 'data-mining-and-analytics',
      type: JobType.REMOTE,
      location: 'Remote (Ethiopia / Global)',
      salaryMin: 70000,
      salaryMax: 120000,
      featured: true,
      tags: ['Python', 'PyTorch', 'Transformers', 'NLP', 'LLMs', 'Amharic AI'],
      experienceLevel: 'Senior',
      description: `Train and fine-tune multilingual natural language processing models for African languages (Amharic, Afaan Oromoo, Tigrinya). Build speech-to-text, translation, and automated resume parsing pipelines.`,
      requirements: `• Strong Python foundations and experience with HuggingFace, PyTorch, and vLLM\n• Demonstrated work in fine-tuning LLMs or local embedding models\n• Publications or open-source NLP contributions appreciated`,
    },
    {
      companyIndex: 4, // Gebeya
      title: 'Technical Talent Acquisition Specialist',
      categorySlug: 'human-resource-and-talent-management',
      type: JobType.REMOTE,
      location: 'Remote',
      salaryMin: 30000,
      salaryMax: 50000,
      featured: false,
      tags: ['Recruiting', 'Tech Talent', 'Screening', 'HR', 'LinkedIn Recruiter'],
      experienceLevel: '2+ years',
      description: `Source, evaluate, and match top African software developers, cloud engineers, and product designers with international enterprise clients.`,
      requirements: `• 2+ years recruiting technical talent across engineering disciplines\n• Sharp ability to evaluate portfolio projects and soft skills`,
    },
    {
      companyIndex: 5, // Dashen Bank
      title: 'Customer Care & Digital Support Specialist',
      categorySlug: 'customer-service-and-care',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 22000,
      salaryMax: 35000,
      featured: false,
      tags: ['Customer Support', 'Call Center', 'Digital Banking', 'Amharic & English'],
      experienceLevel: 'Entry-Mid',
      description: `Provide frontline omnichannel support for Amole and digital branch customers. Resolve inquiries with empathy, patience, and high professionalism.`,
      requirements: `• Fluency in Amharic and English (Oromo is a big plus)\n• Strong communication skills and active listening`,
    },
    {
      companyIndex: 5, // Dashen Bank
      title: 'Senior Financial Analyst & Investment Officer',
      categorySlug: 'accounting-and-finance',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 45000,
      salaryMax: 70000,
      featured: true,
      tags: ['Financial Modeling', 'Valuation', 'Credit Analysis', 'Forecasting'],
      experienceLevel: 'Senior (4+ years)',
      description: `Conduct comprehensive commercial credit risk evaluations, capital appraisal, and liquidity forecasting for corporate banking clients.`,
      requirements: `• BA/MBA in Finance, Economics, or Accounting\n• Advanced financial modeling skills in Excel\n• CFA candidacy or certification valued`,
    },
    {
      companyIndex: 6, // Deliver Addis
      title: 'Growth Marketing & Social Media Manager',
      categorySlug: 'marketing-and-advertisement',
      type: JobType.HYBRID,
      location: 'Addis Ababa',
      salaryMin: 28000,
      salaryMax: 48000,
      featured: false,
      tags: ['Growth Marketing', 'Instagram', 'Telegram', 'Influencer Marketing', 'Content'],
      experienceLevel: '2+ years',
      description: `Drive user acquisition and ordering velocity for restaurant, grocery, and flower delivery across Addis Ababa through viral social campaigns and partner marketing.`,
      requirements: `• Proven track record running successful social campaigns in Ethiopia\n• Proficiency with Canva, Adobe Suite, and Meta Ads Manager`,
    },
    {
      companyIndex: 6, // Deliver Addis
      title: 'Dispatch & Logistics Operations Coordinator',
      categorySlug: 'transportation-and-delivery',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa (Sarbet)',
      salaryMin: 20000,
      salaryMax: 32000,
      featured: false,
      tags: ['Delivery', 'Dispatch', 'Operations', 'Rider Management'],
      experienceLevel: 'Entry-Mid',
      description: `Coordinate real-time motorbike delivery dispatching, monitor customer wait times, and uphold five-star delivery safety and punctuality standards.`,
      requirements: `• High attention to detail and geographic knowledge of Addis Ababa neighborhoods\n• Calm demeanor under pressure during peak lunch/dinner rush hours`,
    },
    {
      companyIndex: 2, // Chapa
      title: 'UI/UX Product Designer (Design Systems)',
      categorySlug: 'creative-art-and-design',
      type: JobType.HYBRID,
      location: 'Addis Ababa / Hybrid',
      salaryMin: 48000,
      salaryMax: 78000,
      featured: true,
      tags: ['Figma', 'UI/UX', 'Design Systems', 'User Research', 'Prototyping'],
      experienceLevel: 'Mid-Senior (3+ years)',
      description: `Shape the future of payments in Ethiopia. You will lead design systems for merchant analytics, consumer payment sheets, and mobile point-of-sale applications.`,
      requirements: `• Standout portfolio showcasing mobile and desktop web product workflows\n• Mastery of Figma (auto-layout, component variants, interactive prototyping)\n• Strong visual aesthetic and respect for typographic hierarchy`,
    },
    {
      companyIndex: 4, // Gebeya
      title: 'Cloud DevOps & Site Reliability Engineer (AWS)',
      categorySlug: 'software-design-and-development',
      type: JobType.REMOTE,
      location: 'Remote',
      salaryMin: 60000,
      salaryMax: 105000,
      featured: true,
      tags: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'CI/CD', 'Prometheus'],
      experienceLevel: 'Senior (4+ years)',
      description: `Architect and automate multi-region cloud environments, CI/CD deployment pipelines, and zero-downtime rolling upgrades across production clusters.`,
      requirements: `• Production experience running Kubernetes clusters (EKS) and Infrastructure as Code\n• Proficiency with GitHub Actions, ArgoCD, and infrastructure monitoring\n• Strong background in Linux systems and network performance tuning`,
    },
    {
      companyIndex: 1, // CBE
      title: 'Corporate Legal Advisor & Compliance Specialist',
      categorySlug: 'law',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 42000,
      salaryMax: 68000,
      featured: false,
      tags: ['Banking Law', 'Commercial Contracts', 'Compliance', 'NBE Directives'],
      experienceLevel: 'Senior (4+ years)',
      description: `Draft, review, and negotiate enterprise banking agreements, syndicated loan facilities, and ensure strict compliance with Ethiopian commercial law.`,
      requirements: `• LLB / LLM degree from an accredited university\n• Licensed to practice in Ethiopian courts\n• Minimum 4 years legal experience in finance or corporate litigation`,
    },
    {
      companyIndex: 0, // Ethio Telecom
      title: 'Fiber Optic Installation & Maintenance Field Engineer',
      categorySlug: 'installation-and-maintenance-technician',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa & Regional Hubs',
      salaryMin: 26000,
      salaryMax: 42000,
      featured: false,
      tags: ['Fiber Optics', 'FTTH', 'Splicing', 'OTDR', 'Field Engineering'],
      experienceLevel: '2+ years',
      description: `Perform high-precision fiber splicing, deployment of Gigabit GPON infrastructure to business premises and residences, and resolve outages swiftly.`,
      requirements: `• Diploma or BSc in Electrical, Electronics, or Telecom Technology\n• Hands-on field experience with fusion splicers and OTDR test meters`,
    },
    {
      companyIndex: 3, // RIDE
      title: 'Data Analyst & Visualization Specialist',
      categorySlug: 'data-mining-and-analytics',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 36000,
      salaryMax: 58000,
      featured: false,
      tags: ['SQL', 'Python', 'PowerBI', 'Tableau', 'Business Intelligence'],
      experienceLevel: 'Mid',
      description: `Transform raw ride telemetry, surge pricing metrics, and driver retention figures into executive dashboards and actionable operational insights.`,
      requirements: `• Advanced SQL proficiency with window functions and query optimization\n• Experience building dashboards in PowerBI or Tableau\n• Basic Python data manipulation (pandas)`,
    },
    {
      companyIndex: 5, // Dashen Bank
      title: 'Executive Assistant & Office Administration Manager',
      categorySlug: 'secretarial-and-office-management',
      type: JobType.FULL_TIME,
      location: 'Addis Ababa',
      salaryMin: 28000,
      salaryMax: 45000,
      featured: false,
      tags: ['Executive Assistant', 'Office Management', 'Correspondence', 'Scheduling'],
      experienceLevel: '3+ years',
      description: `Manage high-level executive schedules, facilitate board committee documentation, and maintain confidential office operations with utmost discretion.`,
      requirements: `• Degree in Secretarial Science, Management, or Business Administration\n• Superb written and verbal communication in Amharic and English`,
    },
    {
      companyIndex: 2, // Chapa
      title: 'Developer Advocate & Community Lead',
      categorySlug: 'media-and-communication',
      type: JobType.HYBRID,
      location: 'Addis Ababa',
      salaryMin: 40000,
      salaryMax: 65000,
      featured: true,
      tags: ['Developer Relations', 'SDKs', 'Technical Writing', 'Public Speaking', 'Hackathons'],
      experienceLevel: 'Mid-Senior',
      description: `Inspire and empower Ethiopian software engineers. Write tutorials, record code walkthroughs, host developer meetups, and provide technical guidance on integrating Chapa APIs.`,
      requirements: `• Software development background with clear public communication skills\n• Experience organizing hackathons or developer community groups\n• Genuine enthusiasm for the Ethiopian developer ecosystem`,
    },
  ];

  const createdJobs: { id: string; title: string; companyId: string }[] = [];

  for (let i = 0; i < jobsData.length; i++) {
    const j = jobsData[i];
    const comp = companies[j.companyIndex % companies.length];
    const categoryId = catMap[j.categorySlug] || defaultCategory;

    const job = await prisma.job.create({
      data: {
        title: j.title,
        description: j.description,
        requirements: j.requirements,
        location: j.location,
        type: j.type,
        status: JobStatus.PUBLISHED,
        featured: j.featured,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        currency: 'ETB',
        tags: j.tags,
        companyName: comp.name,
        companyLogo: employerData[j.companyIndex % employerData.length].company.logoUrl,
        experienceLevel: j.experienceLevel,
        companyId: comp.id,
        categoryId: categoryId,
        vacancies: (i % 3) + 1,
        expiryDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      },
    });

    createdJobs.push({ id: job.id, title: job.title, companyId: comp.id });
  }

  console.log(`✅ ${createdJobs.length} Regular Jobs created`);

  // 5. Create Realistic Job Applications & Scores
  console.log('📝 Seeding Job Applications & Candidate Scores...');

  const appStatuses: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.OFFERED,
  ];

  let appCount = 0;
  for (let i = 0; i < createdJobs.length; i++) {
    const job = createdJobs[i];
    // Assign 2-3 candidates per job
    const candidatesToApply = [jobSeekers[i % jobSeekers.length], jobSeekers[(i + 1) % jobSeekers.length]];

    for (let cIdx = 0; cIdx < candidatesToApply.length; cIdx++) {
      const candidate = candidatesToApply[cIdx];
      const status = appStatuses[(i + cIdx) % appStatuses.length];

      const app = await prisma.application.upsert({
        where: { jobId_userId: { jobId: job.id, userId: candidate.id } },
        update: { status },
        create: {
          jobId: job.id,
          userId: candidate.id,
          status,
          expectedSalary: 45000 + (cIdx * 5000),
          coverLetter: `Dear Hiring Team at ${job.title},\n\nI am writing to express my strong enthusiasm for the ${job.title} opening. With proven experience delivering high-quality results in Ethiopia and a passion for engineering excellence, I am confident I can make an immediate positive contribution.\n\nBest regards,\n${candidate.name}`,
          resumeUrl: 'https://example.com/resumes/sample-candidate.pdf',
        },
      });

      // Attach AI Candidate Score
      const overall = parseFloat((7.5 + (Math.random() * 2.2)).toFixed(1));
      await prisma.candidateScore.upsert({
        where: { applicationId: app.id },
        update: {},
        create: {
          applicationId: app.id,
          userId: candidate.id,
          overallScore: overall,
          skillScore: parseFloat((overall + (Math.random() * 0.6 - 0.3)).toFixed(1)),
          experienceScore: parseFloat((overall + (Math.random() * 0.8 - 0.4)).toFixed(1)),
          cultureFitScore: parseFloat((8.0 + (Math.random() * 1.5)).toFixed(1)),
          reasoning: 'Candidate demonstrates strong contextual domain alignment, relevant previous projects, and verified qualifications.',
        },
      });

      appCount++;
    }
  }

  console.log(`✅ ${appCount} Job Applications with AI candidate scores created`);

  // 6. Create Freelance Ecosystem (Gigs, Bids, Contracts, Milestones, Deliverables)
  console.log('💻 Seeding Freelance Ecosystem (Gigs, Bids, Milestones)...');

  // Freelancer accounts
  const freelancerData = [
    { email: 'kirubel.design@beleqet.demo', firstName: 'Kirubel', lastName: 'Girma', title: 'Senior UI/UX & Brand Designer' },
    { email: 'marta.code@beleqet.demo', firstName: 'Marta', lastName: 'Solomon', title: 'Full Stack React & Node Developer' },
    { email: 'yonas.dev@beleqet.demo', firstName: 'Yonas', lastName: 'Tsegaye', title: 'Mobile Flutter & Dart Specialist' },
    { email: 'selam.writer@beleqet.demo', firstName: 'Selam', lastName: 'Fisseha', title: 'Content Strategist & Amharic Translator' },
  ];

  const freelancers: { id: string; name: string }[] = [];
  for (const f of freelancerData) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      update: {},
      create: {
        email: f.email,
        passwordHash,
        firstName: f.firstName,
        lastName: f.lastName,
        role: UserRole.FREELANCER,
        emailVerified: true,
        rbacRoles: { connect: { name: 'FREELANCER' } },
      },
    });

    // Create Freelancer Wallet
    await prisma.freelancerWallet.upsert({
      where: { userId: user.id },
      update: { availableBalance: 45000, pendingBalance: 15000 },
      create: {
        userId: user.id,
        availableBalance: 45000,
        pendingBalance: 15000,
        currency: 'ETB',
      },
    });

    freelancers.push({ id: user.id, name: `${f.firstName} ${f.lastName}` });
  }

  const defaultFreelanceCat = freelanceCategories[0]?.id || '';

  const freelanceGigs = [
    {
      title: 'E-commerce Website Redesign in Next.js',
      description: 'We need an experienced Next.js developer to modernize our online artisan shop with fast search, Cart, and Chapa integration.',
      budgetMin: 30000,
      budgetMax: 50000,
      deadlineDays: 21,
      skills: ['Next.js', 'TailwindCSS', 'Chapa API', 'PostgreSQL'],
      categorySlug: 'web-development',
    },
    {
      title: 'Complete Corporate Brand Identity & Logo Kit',
      description: 'Design a clean, memorable corporate identity including typography guidelines, business cards, letterheads, and social media banners.',
      budgetMin: 18000,
      budgetMax: 30000,
      deadlineDays: 14,
      skills: ['Figma', 'Illustrator', 'Branding', 'Typography'],
      categorySlug: 'graphic-design',
    },
    {
      title: 'Explainer Motion Graphics Video for Mobile App (60s)',
      description: 'Create an engaging, high-energy 60-second 2D motion graphics explainer with Amharic voiceover and English subtitles.',
      budgetMin: 25000,
      budgetMax: 40000,
      deadlineDays: 15,
      skills: ['After Effects', 'Animation', 'Motion Graphics', 'Audio Sync'],
      categorySlug: 'video-animation',
    },
    {
      title: 'Amharic to English Legal & Financial Document Translation',
      description: 'Accurate certified translation of business charter agreements and audited financial reports from Amharic into legal English.',
      budgetMin: 12000,
      budgetMax: 20000,
      deadlineDays: 7,
      skills: ['Translation', 'Legal English', 'Amharic', 'Proofreading'],
      categorySlug: 'writing',
    },
  ];

  const primaryClient = companies[0].userId;

  for (let i = 0; i < freelanceGigs.length; i++) {
    const gigData = freelanceGigs[i];
    const catId = fcatMap[gigData.categorySlug] || defaultFreelanceCat;

    const fJob = await prisma.freelanceJob.create({
      data: {
        title: gigData.title,
        description: gigData.description,
        clientId: primaryClient,
        categoryId: catId,
        budgetMin: gigData.budgetMin,
        budgetMax: gigData.budgetMax,
        deadlineDays: gigData.deadlineDays,
        skills: gigData.skills,
        status: FreelanceJobStatus.IN_PROGRESS,
        featured: true,
      },
    });

    const chosenFreelancer = freelancers[i % freelancers.length];

    // Create accepted bid
    const bid = await prisma.bid.create({
      data: {
        freelanceJobId: fJob.id,
        freelancerId: chosenFreelancer.id,
        amount: gigData.budgetMax - 2000,
        timelineDays: gigData.deadlineDays - 2,
        coverLetter: `Hi, I have completed similar projects with 100% 5-star ratings. I can deliver ${gigData.title} well within schedule.`,
        status: BidStatus.ACCEPTED,
        qualityScore: 9.4,
      },
    });

    // Create Contract
    const contract = await prisma.contract.create({
      data: {
        freelanceJobId: fJob.id,
        clientId: primaryClient,
        freelancerId: chosenFreelancer.id,
        agreedAmount: bid.amount,
        status: ContractStatus.ACTIVE,
        currency: 'ETB',
      },
    });

    // Create Milestones
    const m1 = await prisma.milestone.create({
      data: {
        contractId: contract.id,
        title: 'Phase 1: Initial Discovery & Draft Wireframes',
        description: 'Complete high-level architectural plan and design mocks for initial client approval.',
        amount: Math.round(bid.amount * 0.4),
        deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        status: MilestoneStatus.APPROVED,
        employerApprovedAt: new Date(),
        freelancerApprovedAt: new Date(),
      },
    });

    await prisma.milestone.create({
      data: {
        contractId: contract.id,
        title: 'Phase 2: Final Implementation & Handover',
        description: 'Complete final deliverables, test execution, and deployment.',
        amount: Math.round(bid.amount * 0.6),
        deadline: new Date(Date.now() + 18 * 24 * 3600 * 1000),
        status: MilestoneStatus.IN_PROGRESS,
      },
    });

    // Create Review
    await prisma.review.create({
      data: {
        freelancerId: chosenFreelancer.id,
        customerId: primaryClient,
        rating: 5,
        comment: `Outstanding execution on ${gigData.title}. Fast communication, clear milestone updates, and great technical craftsmanship!`,
        transactionCurrency: 'ETB',
      },
    });
  }

  console.log(`✅ Freelance contracts, milestones, and client reviews seeded`);

  // 7. Seed Community Forum (Threads & Replies)
  console.log('💬 Seeding Community Forum (Threads & Replies)...');

  const forumThreadsData = [
    {
      title: 'Navigating Freelance Taxes & Invoicing as a Remote Developer in Ethiopia',
      content: `Hello everyone! With more of us working for international clients or on local escrow platforms like Beleqet, what are the best practices for declaring income with ERCA and opening an official TIN business account? Would love to hear everyone's experience.`,
      tags: ['freelance', 'tax', 'invoicing', 'ethiopia', 'career'],
      userIndex: 0,
      upvoteCount: 24,
      replies: [
        {
          userIndex: 1,
          content: 'You can easily obtain a Category C Sole Proprietorship TIN for software consultancy at your local sub-city. It makes receiving Chapa bank transfers 100% compliant!',
          upvotes: 12,
        },
        {
          userIndex: 2,
          content: 'Great advice! Make sure to keep all your milestone transaction receipts downloaded from your Beleqet dashboard.',
          upvotes: 8,
        },
      ],
    },
    {
      title: 'Top Frontend Interview Questions Ethiopian Fintechs are Asking in 2026',
      content: `Just finished interviews with three different banks and fintechs in Addis. Here are the core topics that came up in every technical round:\n\n1. Next.js 14 Server Actions & Hydration\n2. Optimistic UI updates with WebSockets\n3. State reconciliation during network drops\n4. Accessibility standards`,
      tags: ['frontend', 'react', 'nextjs', 'interview-tips', 'fintech'],
      userIndex: 3,
      upvoteCount: 38,
      replies: [
        {
          userIndex: 4,
          content: 'Can confirm! Also make sure to understand token refresh cycles and 2FA TOTP step-up guards.',
          upvotes: 15,
        },
      ],
    },
    {
      title: 'Why Micro-Certifications on Beleqet helped me land my first Software Engineer role',
      content: `I recently completed the technical assessment on Beleqet and got my verified badge. Within two weeks, two companies reached out directly through the portal without me having to cold-apply. Don't skip the profile completeness!`,
      tags: ['success-story', 'profile-tips', 'career-growth'],
      userIndex: 5,
      upvoteCount: 45,
      replies: [
        {
          userIndex: 6,
          content: 'Congratulations Bethlehem! Did you attach your GitHub repositories to your application too?',
          upvotes: 9,
        },
        {
          userIndex: 5,
          content: 'Yes! Having live demo links in the portfolio section makes all the difference.',
          upvotes: 14,
        },
      ],
    },
  ];

  for (const t of forumThreadsData) {
    const author = jobSeekers[t.userIndex % jobSeekers.length];
    const thread = await prisma.forumThread.create({
      data: {
        title: t.title,
        content: t.content,
        tags: t.tags,
        userId: author.id,
        userDisplayName: author.name,
        upvoteCount: t.upvoteCount,
        replyCount: t.replies.length,
      },
    });

    for (const r of t.replies) {
      const replier = jobSeekers[r.userIndex % jobSeekers.length];
      await prisma.forumReply.create({
        data: {
          threadId: thread.id,
          userId: replier.id,
          userDisplayName: replier.name,
          content: r.content,
          upvoteCount: r.upvotes,
        },
      });
    }
  }

  console.log(`✅ Forum threads and interactive replies seeded`);

  // 8. Seed Fraud Alerts (for Admin Fraud Dashboard visibility)
  console.log('🚨 Seeding Fraud Alerts for Admin Dashboard...');

  await prisma.fraudAlert.createMany({
    data: [
      {
        entityType: 'MESSAGING',
        entityId: 'chat-msg-9921',
        ruleType: FraudRuleType.OFF_PLATFORM_PAYMENT,
        severity: FraudSeverity.HIGH,
        score: 88.5,
        reason: 'Detected off-platform communication request: "Contact me on Telegram @direct_pay to avoid platform fees"',
        status: FraudAlertStatus.OPEN,
        currency: 'ETB',
        legalBasis: 'legitimate_interest',
      },
      {
        entityType: 'PAYMENT',
        entityId: 'tx-anom-4401',
        ruleType: FraudRuleType.PAYMENT_ANOMALY,
        severity: FraudSeverity.MEDIUM,
        score: 64.0,
        reason: 'Rapid sequential withdrawal attempts from new IP location',
        status: FraudAlertStatus.UNDER_REVIEW,
        currency: 'USD',
        legalBasis: 'fraud_prevention',
      },
      {
        entityType: 'JOB_LISTING',
        entityId: 'job-flag-1102',
        ruleType: FraudRuleType.DUPLICATE_LISTING,
        severity: FraudSeverity.LOW,
        score: 42.0,
        reason: 'Near 95% text similarity with existing active listing from different company account',
        status: FraudAlertStatus.RESOLVED,
        resolutionNote: 'Verified authorized recruitment agency posting on behalf of client.',
        resolvedAt: new Date(),
        legalBasis: 'quality_assurance',
      },
    ],
  });

  console.log('✅ Fraud alerts seeded');

  // 9. Seed Audit Logs
  console.log('📋 Seeding Admin Audit Logs...');

  await prisma.auditLog.createMany({
    data: [
      {
        action: 'USER_REGISTRATION',
        entityType: 'USER',
        entityId: jobSeekers[0].id,
        newState: { role: 'JOB_SEEKER', status: 'VERIFIED' },
        ipAddress: '197.156.104.22',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      {
        action: 'JOB_PUBLISHED',
        entityType: 'JOB',
        entityId: createdJobs[0].id,
        newState: { title: createdJobs[0].title, status: 'PUBLISHED' },
        ipAddress: '196.188.240.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        action: 'ESCROW_FUNDED',
        entityType: 'ESCROW',
        entityId: 'escrow-contract-001',
        newState: { amount: 35000, currency: 'ETB', status: 'FUNDED' },
        ipAddress: '197.156.90.15',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)',
      },
      {
        action: 'ROLE_ASSIGNED',
        entityType: 'RBAC',
        entityId: companies[0].userId,
        newState: { assignedRole: 'EMPLOYER' },
        ipAddress: '127.0.0.1',
        userAgent: 'Internal Seeder',
      },
    ],
  });

  console.log('✅ Audit logs seeded');

  console.log('\n🌟 Comprehensive Database Seeding Complete! The Beleqet ecosystem is fully populated with rich production-grade data.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
