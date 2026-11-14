import CompanySection from '@/features/dashboard/sections/CompanySection';

/** The website's company form inside the Mini App: every company detail, logo, cover and trade licence. */
export default function MiniAppCompany() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      <CompanySection editOnOpen />
    </div>
  );
}
