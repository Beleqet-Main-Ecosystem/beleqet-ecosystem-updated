/**
 * @module components/mobile/MobileSkeleton
 * @description Mobile-specific loading skeleton components that match
 *   the dimensions and layout of the real mobile dashboard widgets.
 *   Uses Tailwind's `animate-pulse` utility for the shimmer effect.
 *
 * @example
 * ```tsx
 * import { MobileDashboardSkeleton } from "@/components/mobile/MobileSkeleton";
 *
 * <Suspense fallback={<MobileDashboardSkeleton />}>
 *   <DashboardContent />
 * </Suspense>
 * ```
 */

/**
 * Skeleton placeholder for a single {@link MobileStatCard}.
 * Matches the 2 × 2 grid layout used on mobile.
 */
export function MobileStatCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-primary/10 bg-white p-4 animate-pulse">
      <div className="h-9 w-9 rounded-xl bg-pageBg" />
      <div className="mt-3 h-7 w-16 rounded bg-pageBg" />
      <div className="mt-1.5 h-3 w-24 rounded bg-pageBg" />
    </div>
  );
}

/**
 * Skeleton placeholder for the {@link MobileQuickActions} grid.
 * Renders four placeholder action buttons in a 2 × 2 grid.
 */
export function MobileQuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-2.5 rounded-2xl border border-primary/10 bg-white p-5 animate-pulse"
        >
          <div className="h-12 w-12 rounded-2xl bg-pageBg" />
          <div className="h-3 w-16 rounded bg-pageBg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for a single {@link MobileJobCard}.
 * Matches the horizontal strip layout.
 */
export function MobileJobCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white p-3.5 animate-pulse">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-pageBg" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-3/4 rounded bg-pageBg" />
        <div className="mt-2 h-3 w-1/2 rounded bg-pageBg" />
        <div className="mt-1.5 h-3 w-2/5 rounded bg-pageBg" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-5 w-16 rounded-full bg-pageBg" />
        <div className="h-9 w-9 rounded-xl bg-pageBg" />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for a single {@link MobileNotificationItem}.
 */
export function MobileNotificationItemSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/5 bg-white p-3.5 animate-pulse">
      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pageBg" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-3/4 rounded bg-pageBg" />
        <div className="mt-2 h-3 w-full rounded bg-pageBg" />
        <div className="mt-3 h-2.5 w-12 rounded bg-pageBg" />
      </div>
    </div>
  );
}

/**
 * Full-page skeleton for the mobile dashboard.
 * Composes the smaller skeletons into the complete page layout.
 */
export function MobileDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Header skeleton */}
      <div className="bg-gradient-to-br from-brandGreen to-darkGreen px-5 py-12">
        <div className="container-page">
          <div className="h-3 w-28 rounded bg-white/20 animate-pulse" />
          <div className="mt-3 h-8 w-56 rounded bg-white/20 animate-pulse" />
          <div className="mt-1 h-4 w-36 rounded bg-white/15 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="container-page pb-28 pt-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MobileStatCardSkeleton />
          <MobileStatCardSkeleton />
          <MobileStatCardSkeleton />
        </div>

        {/* Quick Actions */}
        <MobileQuickActionsSkeleton />

        {/* Recent jobs */}
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="h-5 w-1 rounded-full bg-pageBg animate-pulse" />
            <div className="h-4 w-32 rounded bg-pageBg animate-pulse" />
          </div>
          <div className="space-y-3">
            <MobileJobCardSkeleton />
            <MobileJobCardSkeleton />
            <MobileJobCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}