import Link from "next/link";
import { ArrowRight, Send } from "lucide-react";

export default function CTABanner() {
  return (
    <section className="container-page pb-20">
      <div className="relative overflow-hidden rounded-[32px] bg-[#ffbc80] px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[45px] border-primary/5" />
        <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-[#ffbc80]">
              <Send className="h-5 w-5" />
            </span>
            <h2 className="max-w-2xl text-[clamp(2rem,4vw,3.8rem)] font-black leading-none tracking-[-.05em] text-primary">
              Good opportunities
              <br />
              should find you, too.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary/65">
              Join our Telegram community for curated job alerts, career
              resources, and updates delivered directly to you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://t.me/BeleqetJobs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brandGreen"
            >
              Join Telegram <Send className="h-4 w-4" />
            </a>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-6 py-3.5 text-sm font-bold text-primary hover:bg-white/30"
            >
              Browse jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
