import Link from 'next/link';
import FreelanceBidActions from '@/components/FreelanceBidActions';

export const revalidate = 60;

type Gig = {
  id: string;
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  currency?: string;
  pricingType?: string;
  deadlineDays?: number;
  skills?: string[];
  status?: string;
  experienceLevel?: string | null;
  locationPreference?: string | null;
  category?: { label?: string; slug?: string } | null;
  client?: {
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
  bids?: unknown[];
};

const DEMO_GIGS: Record<string, Gig> = {
  '1': {
    id: '1',
    title: 'React Native Mobile App — Fintech MVP',
    description: 'Demo project: Build a mobile fintech MVP using React Native and TypeScript, connect REST APIs, implement app screens, and prepare the application for testing.',
    budgetMin: 12000, budgetMax: 20000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 30,
    skills: ['React Native', 'TypeScript', 'REST API'],
    status: 'OPEN',
    category: { label: 'Web & App Development', slug: 'web-app-dev' },
    client: { name: 'FinTech Startup' },
  },
  '2': {
    id: '2',
    title: 'Logo & Brand Identity Kit',
    description: 'Demo project: Create a distinctive logo and visual identity for a boutique coffee roastery, including logo variations, a color palette, typography, and brand assets.',
    budgetMin: 3500, budgetMax: 6000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 10,
    skills: ['Illustrator', 'Branding', 'Figma'],
    status: 'OPEN',
    category: { label: 'Graphic Design', slug: 'design-creative' },
    client: { name: 'Boutique Roastery' },
  },
  '3': {
    id: '3',
    title: 'Amharic–English Document Translation',
    description: 'Demo project: Translate documents between Amharic and English while preserving meaning, formatting, terminology, and a professional tone.',
    budgetMin: 2000, budgetMax: 3500, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 7,
    skills: ['Amharic', 'English', 'Legal Text'],
    status: 'OPEN',
    category: { label: 'Writing & Translation', slug: 'writing-translation' },
    client: { name: 'NGO Ethiopia' },
  },
  '4': {
    id: '4',
    title: 'Product Explainer Video (60s)',
    description: 'Demo project: Produce a polished 60-second explainer video for an educational product using motion graphics and clear visual storytelling.',
    budgetMin: 8000, budgetMax: 14000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 14,
    skills: ['After Effects', 'Motion Design'],
    status: 'OPEN',
    category: { label: 'Video & Animation', slug: 'video-animation' },
    client: { name: 'EdTech Company' },
  },
  '5': {
    id: '5',
    title: 'SEO Audit & Content Strategy (30-day)',
    description: 'Demo project: Review website SEO, research keywords, identify technical and on-page improvements, and prepare a practical 30-day content strategy.',
    budgetMin: 4000, budgetMax: 7000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 30,
    skills: ['SEO', 'Content Marketing', 'Analytics'],
    status: 'OPEN',
    category: { label: 'Digital Marketing', slug: 'marketing-seo' },
    client: { name: 'FMCG Brand' },
  },
  '6': {
    id: '6',
    title: 'Monthly Bookkeeping & Reporting',
    description: 'Demo project: Organize financial transactions, reconcile accounts, and prepare monthly financial reports using accounting software and spreadsheets.',
    budgetMin: 3000, budgetMax: 3000, currency: 'ETB/mo',
    pricingType: 'RETAINER', deadlineDays: 30,
    skills: ['QuickBooks', 'Excel', 'IFRS'],
    status: 'OPEN',
    category: { label: 'Finance & Accounting', slug: 'finance-accounting' },
    client: { name: 'Small Retailer' },
  },
  '7': {
    id: '7',
    title: 'E-commerce Website (Next.js)',
    description: 'Demo project: Build a responsive e-commerce website with Next.js and Tailwind CSS, including product listings, product pages, and a shopping experience.',
    budgetMin: 15000, budgetMax: 25000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 30,
    skills: ['Next.js', 'Tailwind CSS', 'Stripe'],
    status: 'OPEN',
    category: { label: 'Web & App Development', slug: 'web-app-dev' },
    client: { name: 'Fashion Store' },
  },
  '8': {
    id: '8',
    title: 'Product Photography — 20 SKUs',
    description: 'Demo project: Photograph 20 cosmetics products with consistent lighting, accurate colors, clean compositions, and professionally retouched images for an online catalogue.',
    budgetMin: 5000, budgetMax: 9000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 10,
    skills: ['Photography', 'Lightroom', 'Retouching'],
    status: 'OPEN',
    category: { label: 'Photography', slug: 'photography' },
    client: { name: 'Cosmetics Brand' },
  },
  '9': {
    id: '9',
    title: 'Data Dashboard — Power BI',
    description: 'Demo project: Build an interactive Power BI dashboard, organize key business metrics, create useful visualizations, and work with SQL and Excel data.',
    budgetMin: 6000, budgetMax: 10000, currency: 'ETB',
    pricingType: 'FIXED', deadlineDays: 14,
    skills: ['Power BI', 'SQL', 'Excel'],
    status: 'OPEN',
    category: { label: 'Data & Analytics', slug: 'data-analytics' },
    client: { name: 'Insurance Co.' },
  },
};

async function getGig(id: string): Promise<Gig | null> {
  try {
    const api =
      process.env.NEXT_PUBLIC_API_URL ??
      'https://api.beleqetjobs.com/api/v1';

    const response = await fetch(
      `${api}/freelance/jobs/${encodeURIComponent(id)}`,
      { next: { revalidate: 60 } },
    );

    if (response.ok) {
      const data = await response.json();
      const gig = data?.item ?? data?.job ?? data;

      if (gig && typeof gig.title === 'string' && gig.title) {
        return gig as Gig;
      }
    }
  } catch {
    // Use demo data if the API is unavailable.
  }

  return DEMO_GIGS[id] ?? null;
}

export default async function FreelanceGigDetail({
  params,
}: {
  params: { id: string };
}) {
  const gig = await getGig(params.id);

  if (!gig || !gig.title) {
    return (
      <main className="container-page min-h-[60vh] py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-primary/10 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-black text-primary dark:text-white">
            Gig not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted dark:text-slate-400">
            This project may have been removed, or it may no longer be available.
            Browse the marketplace to find available projects.
          </p>
          <Link
            href="/freelance"
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90"
          >
            Back to freelance gigs
          </Link>
        </div>
      </main>
    );
  }

  const clientName =
    gig.client?.name ||
    [gig.client?.firstName, gig.client?.lastName].filter(Boolean).join(' ') ||
    'Client';

  const budget =
    gig.budgetMin === gig.budgetMax
      ? gig.budgetMin.toLocaleString()
      : `${gig.budgetMin.toLocaleString()} – ${gig.budgetMax.toLocaleString()}`;

  return (
    <main className="container-page min-h-[60vh] py-12">
      <Link
        href="/freelance"
        className="text-sm font-semibold text-brandGreen hover:underline"
      >
        ← Back to freelance gigs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border border-primary/10 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-brandGreen">
            {gig.category?.label ?? 'Freelance project'}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-primary dark:text-white">
            {gig.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted dark:text-slate-400">
            <span>Posted by {clientName}</span>
            {gig.status && <span>• {gig.status.replace(/_/g, ' ')}</span>}
          </div>

          <div className="my-8 border-t border-primary/10 dark:border-slate-800" />

          <h2 className="text-lg font-bold text-primary dark:text-white">
            Project description
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/80 dark:text-slate-300">
            {gig.description || 'No description provided.'}
          </p>

          {gig.skills && gig.skills.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold text-primary dark:text-white">
                Skills required
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {gig.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-brandGreen/10 px-3 py-1.5 text-sm font-medium text-brandGreen"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="h-fit rounded-2xl border border-primary/10 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-muted dark:text-slate-400">Project budget</p>
          <p className="mt-2 text-2xl font-black text-primary dark:text-white">
            {gig.currency || 'ETB'} {budget}
          </p>

          {gig.pricingType && (
            <p className="mt-3 text-sm text-muted dark:text-slate-400">
              Type: {gig.pricingType.replace(/_/g, ' ')}
            </p>
          )}
          {gig.deadlineDays != null && (
            <p className="mt-2 text-sm text-muted dark:text-slate-400">
              Deadline: {gig.deadlineDays} days
            </p>
          )}
          {gig.experienceLevel && (
            <p className="mt-2 text-sm text-muted dark:text-slate-400">
              Experience: {gig.experienceLevel}
            </p>
          )}
          {gig.locationPreference && (
            <p className="mt-2 text-sm text-muted dark:text-slate-400">
              Location: {gig.locationPreference}
            </p>
          )}

          <FreelanceBidActions gigId={gig.id} gigTitle={gig.title} budgetDefault={gig.budgetMin} />
        </aside>
      </div>
    </main>
  );
}
