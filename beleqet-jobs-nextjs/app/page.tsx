import { Suspense } from "react";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import CategorySection from "@/components/CategorySection";
import FeaturedSection from "@/components/FeaturedSection";
import WhyChoose from "@/components/WhyChoose";
import CTABanner from "@/components/CTABanner";
import { CategoryGridSkeleton, FeaturedJobsSkeleton } from "@/components/Skeletons";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategorySection />
      </Suspense>
      <Suspense fallback={<FeaturedJobsSkeleton />}>
        <FeaturedSection />
      </Suspense>
      <WhyChoose />
      <CTABanner />
    </>
  );
}
