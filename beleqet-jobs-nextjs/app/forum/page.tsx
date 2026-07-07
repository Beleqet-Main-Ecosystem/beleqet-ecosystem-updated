import { Suspense } from "react";
import { MessageSquare, Plus, Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import ThreadCard from "@/components/forum/ThreadCard";
import { getThreads } from "@/lib/forum-api";

export const revalidate = 30;

interface Props {
  searchParams: { [key: string]: string | undefined };
}

async function ThreadList({ searchParams }: Props) {
  let data;
  try {
    data = await getThreads({
      page: 1,
      limit: 20,
      sort: searchParams.sort,
      search: searchParams.search,
      tag: searchParams.tag,
    });
  } catch {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center animate-in fade-in duration-500">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-redAccent">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-primary">Unable to load discussions</p>
          <p className="mt-1 text-sm text-muted">Make sure the backend server is running.</p>
        </div>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center animate-in fade-in duration-500">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-pageBg text-muted">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-primary">No discussions found</p>
          <p className="mt-1 text-sm text-muted">Be the first to start one!</p>
        </div>
        <Link
          href="/forum/new"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-brandGreen px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:bg-darkGreen hover:shadow-lg hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          Create Thread
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((thread, i) => (
          <div
            key={thread.id}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <ThreadCard thread={thread} />
          </div>
        ))}
      </div>
      {data.pagination.totalPages > 1 && (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => {
            const isActive = p === (searchParams.page ? Number(searchParams.page) : 1);
            return (
              <Link
                key={p}
                href={`/forum?page=${p}`}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-brandGreen text-white shadow-md"
                    : "border border-border bg-white text-muted hover:border-brandGreen/40 hover:text-brandGreen hover:shadow-sm"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function ForumPage({ searchParams }: Props) {
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Hero */}
      <section className="bg-primary overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.07] hero-grid" />
        <div className="container-page relative py-14 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d8ff3e]/15 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              <Sparkles className="h-3.5 w-3.5" />
              Community
            </span>
            <h1 className="text-pageH1 mt-4 text-white">
              Community Forum
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              Share experiences, ask questions, and help fellow freelancers grow together
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/forum/new"
                className="group inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3 text-sm font-extrabold text-primary transition-all duration-300 hover:bg-[#c8ef2e] hover:shadow-lg hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                Create Thread
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/50">
                <TrendingUp className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {searchParams.sort === "oldest" ? "Oldest first" : "Latest first"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Threads */}
      <section className="container-page py-10 sm:py-16">
        <Suspense
          fallback={
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[22px] border border-primary/10 bg-white p-5 shadow-card"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="h-5 w-3/4 rounded-full bg-pageBg" />
                    <div className="h-10 w-10 rounded-xl bg-pageBg" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded-full bg-pageBg" />
                    <div className="h-3 w-2/3 rounded-full bg-pageBg" />
                  </div>
                  <div className="mt-4 flex gap-1.5">
                    <div className="h-5 w-14 rounded-full bg-pageBg" />
                    <div className="h-5 w-16 rounded-full bg-pageBg" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-3">
                    <div className="h-3 w-20 rounded-full bg-pageBg" />
                    <div className="h-3 w-16 rounded-full bg-pageBg" />
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <ThreadList searchParams={searchParams} />
        </Suspense>
      </section>

      {/* CTA Banner */}
      <section className="container-page pb-10 sm:pb-20">
        <div className="group relative overflow-hidden rounded-[32px] bg-primary px-6 py-12 text-center text-white shadow-[0_20px_60px_-15px_rgba(4,22,3,0.4)] transition-all duration-500 hover:shadow-[0_25px_70px_-15px_rgba(4,22,3,0.5)]">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[40px] border-white/5 transition-all duration-500 group-hover:scale-110" />
          <div className="absolute -left-20 -bottom-20 h-48 w-48 rounded-full border-[30px] border-white/5 transition-all duration-500 group-hover:scale-110" />
          <div className="relative">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              Join the conversation
            </p>
            <h2 className="text-sectionH2 mt-3">
              Have something to share?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Start a discussion, ask for advice, or share your experience with the community.
            </p>
            <Link
              href="/forum/new"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3 text-sm font-extrabold text-primary transition-all duration-300 hover:bg-[#c8ef2e] hover:-translate-y-0.5"
            >
              Create a Thread
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
