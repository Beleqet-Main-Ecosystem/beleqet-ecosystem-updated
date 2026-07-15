import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  Search,
  Users,
} from "lucide-react";

const values = [
  {
    icon: CheckCircle2,
    title: "Trust before traffic",
    text: "A useful marketplace starts with credible employers, clear listings, and accountable processes.",
  },
  {
    icon: Globe2,
    title: "Built for local reality",
    text: "Beleqet is designed around Ethiopia’s talent, employers, mobile habits, and growing digital economy.",
  },
  {
    icon: HeartHandshake,
    title: "Opportunity with dignity",
    text: "Candidates deserve clarity and respect; employers deserve relevant tools and serious applicants.",
  },
];

export const metadata = {
  title: "About Beleqet | Ethiopia’s Career Marketplace",
};

export default function AboutPage() {
  return (
    <div className="bg-[#f7f5ef]">
      <section className="relative overflow-hidden bg-primary py-20 text-white lg:py-28">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full border-[70px] border-[#d8ff3e]/10" />
        <div className="container-page relative">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Our purpose
          </p>
          <h1 className="mt-5 max-w-5xl text-[clamp(3.2rem,8vw,7.5rem)] font-black leading-[.86] tracking-[-.065em]">
            Ethiopian talent
            <br />
            deserves better access.
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-white/60">
            Beleqet connects ambitious people with credible employers through
            one focused career marketplace—making discovery, application, and
            hiring simpler for everyone.
          </p>
        </div>
      </section>
      <section className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-brandGreen">
            Why we exist
          </p>
          <h2 className="mt-4 text-[clamp(2.2rem,5vw,4.5rem)] font-black leading-[.95] tracking-[-.055em] text-primary">
            The distance between talent and opportunity should be shorter.
          </h2>
        </div>
        <div className="space-y-5 text-sm leading-7 text-muted">
          <p>
            Too many qualified people lose time navigating fragmented listings,
            unclear requirements, and unreliable hiring channels. Employers face
            the other side of the same problem: reaching candidates who fit the
            role.
          </p>
          <p>
            Beleqet brings job discovery, candidate profiles, CV tools,
            applications, employer publishing, and timely alerts into a single
            platform. The goal is practical: reduce friction and help the right
            people find each other.
          </p>
        </div>
      </section>
      <section className="border-y border-primary/10 bg-white">
        <div className="container-page grid grid-cols-2 md:grid-cols-4">
          {[
            { icon: Search, value: "10K+", label: "Active opportunities" },
            { icon: Building2, value: "5K+", label: "Hiring companies" },
            { icon: Users, value: "50K+", label: "Career profiles" },
            {
              icon: BriefcaseBusiness,
              value: "One",
              label: "Connected marketplace",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border-primary/10 p-7 even:border-l md:border-l first:md:border-l-0"
            >
              <item.icon className="h-5 w-5 text-brandGreen" />
              <p className="mt-5 text-3xl font-black tracking-tight text-primary">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="container-page py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-brandGreen">
            What guides us
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-.04em] text-primary">
            A marketplace people can rely on.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {values.map((value, index) => (
            <div
              key={value.title}
              className="rounded-[24px] border border-primary/10 bg-white p-7"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
                  <value.icon className="h-5 w-5" />
                </span>
                <span className="text-3xl font-black text-primary/10">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-8 text-lg font-black text-primary">
                {value.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{value.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container-page pb-20">
        <div className="flex flex-col justify-between gap-7 rounded-[30px] bg-[#d8ff3e] p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-primary">
              Make your next move.
            </h2>
            <p className="mt-2 text-sm text-primary/65">
              Explore verified roles or join Beleqet to build your career
              profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              Find jobs <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-primary/20 px-5 py-3 text-sm font-bold text-primary"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
