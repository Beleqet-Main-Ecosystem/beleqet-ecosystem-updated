export default function Loading() {
  const bar = 'rounded-md bg-ink-100 dark:bg-slate-800';
  const card = 'rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900';
  return (
    <div aria-busy="true" aria-label="Loading job">
      <div className="bg-primary">
        <div className="mx-auto flex max-w-[1200px] items-start gap-5 px-4 pb-9 pt-10 sm:px-6 lg:px-10">
          <div className="h-[72px] w-[72px] shrink-0 rounded-[14px] bg-white/10" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="h-9 w-2/3 rounded-md bg-white/10" />
            <div className="h-4 w-1/3 rounded-md bg-white/10" />
            <div className="h-4 w-1/2 rounded-md bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pt-8 sm:px-6 md:flex-row lg:px-10">
        <div className={`${card} flex flex-1 animate-pulse flex-col gap-3 p-8`}>
          <span className={`h-5 w-40 ${bar}`} />
          {[90, 95, 80, 60, 85, 70].map((w) => <span key={w} className={`h-3.5 ${bar}`} style={{ width: `${w}%` }} />)}
        </div>
        <div className={`${card} h-80 w-full md:w-[340px]`} />
      </div>
    </div>
  );
}
