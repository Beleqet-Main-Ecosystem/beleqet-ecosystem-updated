/** Shown on first load of /jobs; later filter changes dim the current results instead. */
export default function Loading() {
  const bar = 'rounded-md bg-ink-100 dark:bg-slate-800';
  return (
    <div aria-busy="true" aria-label="Loading jobs">
      <div className="bg-primary">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 lg:px-10">
          <div className="h-8 w-56 rounded-md bg-white/10" />
          <div className="h-[66px] rounded-xl bg-white/10" />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] gap-7 px-4 pb-16 pt-7 sm:px-6 lg:px-10">
        <div className="hidden h-[520px] w-[280px] shrink-0 rounded-xl border border-ink-200 bg-surface md:block dark:border-slate-800 dark:bg-slate-900" />
        <div className="flex flex-1 flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse gap-4 rounded-xl border border-ink-200 bg-surface p-[22px] dark:border-slate-800 dark:bg-slate-900">
              <span className={`h-12 w-12 ${bar}`} />
              <span className="flex flex-1 flex-col gap-2.5">
                <span className={`h-4 w-[45%] ${bar}`} />
                <span className={`h-3 w-[30%] ${bar}`} />
                <span className={`h-3 w-[55%] ${bar}`} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
