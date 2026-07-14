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
  Star,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { roleMeta } from "@/components/HeaderAuth";
import { authenticatedFetch } from "@/lib/auth";
import { ReviewStats } from "@/components/reviews/ReviewStats";
import { ReviewCard } from "@/components/reviews/ReviewCard";

type Profile = {
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  skills?: string[] | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  contract?: {
    freelanceJob: {
      title: string;
    };
  };
};

type RatingStats = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

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

  useEffect(() => {
    if (!user) return;

    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    setLoadingReviews(true);

    // Fetch reviews and rating stats
    Promise.all([
      authenticatedFetch(`${base}/reviews/freelancer/${user.id}`),
      authenticatedFetch(`${base}/reviews/stats/${user.id}`),
    ])
      .then(([reviewsRes, statsRes]) =>
        Promise.all([
          reviewsRes.ok ? reviewsRes.json() : [],
          statsRes.ok ? statsRes.json() : null,
        ])
      )
      .then(([reviewsData, statsData]) => {
        setReviews(reviewsData);
        setRatingStats(statsData);
      })
      .catch(() => {
        setReviews([]);
        setRatingStats(null);
      })
      .finally(() => {
        setLoadingReviews(false);
      });
  }, [user]);

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

      {/* Reviews Section */}
      {user.role === 'FREELANCER' && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-brandGreen" />
            <h2 className="text-xl font-extrabold text-ink">Reviews & Ratings</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Rating Stats */}
            <div className="lg:col-span-1">
              {loadingReviews ? (
                <div className="rounded-2xl border border-border bg-white p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-gray-200 rounded-full dark:bg-gray-700" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-2 bg-gray-200 rounded dark:bg-gray-700" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : ratingStats ? (
                <ReviewStats
                  averageRating={ratingStats.averageRating}
                  totalReviews={ratingStats.totalReviews}
                  ratingDistribution={ratingStats.ratingDistribution}
                />
              ) : null}
            </div>

            {/* Reviews List */}
            <div className="lg:col-span-2">
              {loadingReviews ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border border-border bg-white p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-gray-200 rounded-full dark:bg-gray-700" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700" />
                            <div className="h-3 bg-gray-200 rounded w-3/4 dark:bg-gray-700" />
                          </div>
                        </div>
                        <div className="h-16 bg-gray-200 rounded dark:bg-gray-700" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      reviewerName={`${review.reviewer.firstName} ${review.reviewer.lastName}`}
                      reviewerAvatar={review.reviewer.avatarUrl}
                      rating={review.rating}
                      comment={review.comment}
                      createdAt={new Date(review.createdAt)}
                      contractTitle={review.contract?.freelanceJob.title}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-white p-12 text-center">
                  <Star className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-4 text-lg font-semibold text-ink">No reviews yet</h3>
                  <p className="mt-2 text-sm text-muted">
                    Complete projects to start receiving reviews from clients.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
