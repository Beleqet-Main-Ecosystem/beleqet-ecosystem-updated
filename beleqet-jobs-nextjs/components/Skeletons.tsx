export function JobCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-white p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-pageBg" />
        <div className="h-4 w-4 rounded bg-pageBg" />
      </div>
      <div className="h-4 w-3/4 rounded bg-pageBg mt-4" />
      <div className="h-3 w-1/2 rounded bg-pageBg mt-3" />
      <div className="h-3 w-2/5 rounded bg-pageBg mt-3" />
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <div className="h-5 w-20 rounded-full bg-pageBg" />
        <div className="h-3 w-12 rounded bg-pageBg" />
      </div>
    </div>
  );
}

export function FeaturedJobsSkeleton() {
  return (
    <section className="bg-white border-y border-border">
      <div className="container-page py-14">
        <div className="h-6 w-48 rounded bg-pageBg mb-6 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CategoryGridSkeleton() {
  return (
    <section className="container-page py-14">
      <div className="h-6 w-56 rounded bg-pageBg mb-6 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-3 py-5 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-pageBg" />
            <div className="h-3 w-16 rounded bg-pageBg" />
            <div className="h-2.5 w-10 rounded bg-pageBg" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function JobsListingSkeleton() {
  return (
    <div className="container-page py-10">
      <div className="h-8 w-2/3 rounded bg-pageBg animate-pulse" />
      <div className="h-4 w-24 rounded bg-pageBg mt-3 animate-pulse" />
      <div className="h-16 rounded-2xl border border-border bg-white mt-6 mb-8 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <div className="h-72 rounded-xl border border-border bg-white animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="container-page py-10">
      <div className="h-4 w-32 rounded bg-pageBg animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="rounded-2xl border border-border bg-white p-7 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-pageBg" />
            <div className="flex-1">
              <div className="h-6 w-2/3 rounded bg-pageBg" />
              <div className="h-4 w-1/3 rounded bg-pageBg mt-3" />
            </div>
          </div>
          <div className="h-40 rounded bg-pageBg mt-7" />
        </div>
        <div className="h-40 rounded-2xl border border-border bg-white animate-pulse" />
      </div>
    </div>
  );
}
