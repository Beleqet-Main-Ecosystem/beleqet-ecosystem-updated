"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  MapPin,
  Briefcase,
  FileText,
  Search,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { roleMeta } from "@/components/HeaderAuth";
import { authenticatedFetch } from "@/lib/auth";

type Profile = {
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  skills?: string[] | null;
};

const quickActionsByRole: Record<
  string,
  { label: string; href: string; icon: typeof Briefcase }[]
> = {
  JOB_SEEKER: [
    { label: "Find Jobs", href: "/jobs", icon: Search },
    { label: "My Applications", href: "/applications", icon: FileText },
  ],
  EMPLOYER: [
    { label: "Post a Job", href: "/post-job", icon: Briefcase },
    { label: "Hiring Dashboard", href: "/employer", icon: FileText },
  ],
  FREELANCER: [
    { label: "Find Gigs", href: "/jobs", icon: Search },
    { label: "My Bids", href: "/jobs", icon: FileText },
  ],
  ADMIN: [
    { label: "Browse Jobs", href: "/jobs", icon: Search },
    { label: "Post a Job", href: "/post-job", icon: Briefcase },
  ],
};

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    authenticatedFetch(`${base}/users/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setProfile(data))
      .catch(() => {});
  }, []);

  if (!ready || !user) {
    return (
      <div className="container-page py-24 text-center text-muted">
        Loading your profile…
      </div>
    );
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  const role = roleMeta[user.role] ?? {
    label: user.role,
    className: "bg-muted/10 text-muted",
  };
  const actions =
    quickActionsByRole[user.role] ?? quickActionsByRole.JOB_SEEKER;

  return (
    <div className="container-page py-10">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
        <div className="h-28 bg-gradient-to-br from-brandGreen to-darkGreen" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-brandGreen to-darkGreen text-2xl font-bold uppercase text-white shadow-card">
              {initials}
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-ink">
                  {user.firstName} {user.lastName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${role.className}`}
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> {role.label}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-5 hover:border-brandGreen hover:shadow-card transition-all"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brandGreen/10 text-brandGreen">
              <a.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{a.label}</p>
              <p className="text-xs text-muted">
                Go to {a.label.toLowerCase()}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">About</h2>
          {profile?.headline && (
            <p className="mt-3 font-medium text-ink">{profile.headline}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {profile?.bio ||
              "You haven’t added a bio yet. A short summary helps employers get to know you."}
          </p>
          {profile?.location && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="h-4 w-4" /> {profile.location}
            </p>
          )}
          {profile?.skills && profile.skills.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-pageBg px-3 py-1 text-xs font-medium text-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Full name</dt>
              <dd className="font-medium text-ink">
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Account type</dt>
              <dd className="font-medium text-ink">{role.label}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Status</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-brandGreen">
                <ShieldCheck className="h-4 w-4" /> Active
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
