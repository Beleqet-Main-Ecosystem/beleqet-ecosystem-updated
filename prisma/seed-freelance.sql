INSERT INTO freelance_jobs (
  id, title, description, "categoryId", "clientId", "budgetMin", "budgetMax", currency, "pricingType", "deadlineDays", skills, status, featured, "createdAt", "updatedAt"
) VALUES
(
  gen_random_uuid(),
  'React Native Mobile App — Fintech MVP',
  'Build a cross-platform fintech MVP in React Native with secure authentication, local state management, and real-time transaction history.',
  'c9769a90-4f76-4a70-be69-ae808a96698e',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  15000, 30000, 'ETB', 'FIXED', 30,
  ARRAY['React Native', 'TypeScript', 'REST API', 'Tailwind'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Next.js E-Commerce Storefront with Payment Gateway',
  'Develop a modern responsive e-commerce web application using Next.js 14 and TailwindCSS, including cart checkout and Telebirr/Chapa payment integration.',
  'c9769a90-4f76-4a70-be69-ae808a96698e',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  20000, 45000, 'ETB', 'FIXED', 21,
  ARRAY['Next.js', 'React', 'Chapa API', 'TailwindCSS'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Complete Brand Identity & Logo Package for Coffee Exporter',
  'Create a premium corporate visual identity including logo mark, typography guidelines, packaging mockups, and business stationery.',
  '83e57dc6-b87f-4b0a-b49a-af2626acc46e',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  8000, 18000, 'ETB', 'FIXED', 14,
  ARRAY['Figma', 'Illustrator', 'Branding', 'Packaging'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'UI/UX Mobile App Redesign in Figma',
  'Design high-fidelity interactive Figma prototypes, component library, and user flows for an on-demand logistics mobile application.',
  '83e57dc6-b87f-4b0a-b49a-af2626acc46e',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  12000, 22000, 'ETB', 'FIXED', 15,
  ARRAY['Figma', 'Mobile UI', 'Design System', 'Prototyping'],
  'OPEN', false, NOW(), NOW()
),
(
  gen_random_uuid(),
  'English to Amharic Legal & Business Contract Translation',
  'Accurate technical translation of commercial agreements, NDA contracts, and company bylaws from English to Amharic with legal terminology precision.',
  'a3782f55-329a-4b9a-8e5b-ae6b36ab352a',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  5000, 10000, 'ETB', 'FIXED', 7,
  ARRAY['Amharic', 'English', 'Legal Translation', 'Proofreading'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Tech & Startup Blog Writer (Weekly Articles)',
  'Write well-researched, SEO-optimized articles and technical guides exploring fintech, software development, and digital entrepreneurship in Ethiopia.',
  'a3782f55-329a-4b9a-8e5b-ae6b36ab352a',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  6000, 12000, 'ETB', 'FIXED', 30,
  ARRAY['SEO Writing', 'Copywriting', 'Tech Content', 'English'],
  'OPEN', false, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Telegram Channel & TikTok Growth Specialist',
  'Develop and execute an organic growth and engagement strategy for our Telegram announcement channel and official TikTok profile.',
  '41a07f6a-10d9-41a8-91ff-7154999e0d4f',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  7500, 15000, 'ETB', 'FIXED', 30,
  ARRAY['Telegram Marketing', 'TikTok Ads', 'Content Strategy'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Google Ads & Meta Performance Marketing Campaign',
  'Set up, optimize, and manage conversion campaigns across Meta Ads Manager and Google Ads for our e-commerce product launch.',
  '41a07f6a-10d9-41a8-91ff-7154999e0d4f',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  10000, 20000, 'ETB', 'FIXED', 14,
  ARRAY['Meta Ads', 'Google Ads', 'Analytics', 'Conversion Optimization'],
  'OPEN', false, NOW(), NOW()
),
(
  gen_random_uuid(),
  '60-Second 2D Animated Explainer Video with Voiceover',
  'Produce a professional 60-second animated explainer video covering scriptwriting, custom character animation, and background music integration.',
  'a7abb386-e01f-4338-94b3-2cd620cb9f77',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  14000, 25000, 'ETB', 'FIXED', 10,
  ARRAY['2D Animation', 'After Effects', 'Motion Graphics', 'Storyboarding'],
  'OPEN', true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'Short-Form Video Editor (Reels, TikTok & Shorts)',
  'Edit high-retention short-form videos with dynamic captions, sound effects, transitions, and pacing designed for viral social media distribution.',
  'a7abb386-e01f-4338-94b3-2cd620cb9f77',
  '7fee4aff-d7c1-4493-b64c-ec51b9f882bd',
  8000, 16000, 'ETB', 'FIXED', 20,
  ARRAY['Premiere Pro', 'CapCut', 'Color Grading', 'Sound Design'],
  'OPEN', false, NOW(), NOW()
);
