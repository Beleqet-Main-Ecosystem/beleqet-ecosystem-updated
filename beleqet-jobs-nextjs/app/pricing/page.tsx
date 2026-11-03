import PricingPage from '@/features/pricing/PricingPage';
import { fetchPlans } from '@/lib/api';
import { pricingPageMetadata } from '@/lib/seo/generate-metadata';

export const metadata = pricingPageMetadata();
export const revalidate = 60;

export default async function Pricing() {
  return <PricingPage plans={await fetchPlans()} />;
}
