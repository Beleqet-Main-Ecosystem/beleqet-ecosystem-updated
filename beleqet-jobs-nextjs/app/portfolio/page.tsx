import { Suspense } from "react";
import PortfolioBuilderClient from "./portfolio/builder/PortfolioBuilderClient";

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-16 text-center text-ink/60">
          Loading portfolio builder…
        </div>
      }
    >
      <PortfolioBuilderClient />
    </Suspense>
  );
}
