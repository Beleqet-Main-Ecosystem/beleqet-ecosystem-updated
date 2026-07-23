'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, MapPin, Briefcase, FileText, Search, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { roleMeta } from '@/components/HeaderAuth';
import { authenticatedFetch } from '@/lib/auth';
import AvailabilityCard from '@/components/interview-planner/AvailabilityCard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
type Profile = {
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  skills?: string[] | null;
};

type Subscription = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: { name: string; priceAmount: number; currency: string };
};

const subscriptionStatusMeta: Record<Subscription['status'], { label: string; className: string }> = {
  PENDING: { label: 'Pending approval', className: 'text-muted' },
  ACTIVE: { label: 'Active', className: 'text-brandGreen' },
  PAST_DUE: { label: 'Payment failed', className: 'text-redAccent' },
  CANCELLED: { label: 'Cancelled', className: 'text-muted' },
  EXPIRED: { label: 'Expired', className: 'text-redAccent' },
};

const quickActionsByRole: Record<
  string,
  { label: string; href: string; icon: typeof Briefcase }[]
> = {
  JOB_SEEKER: [
    { label: 'Find Jobs', href: '/jobs', icon: Search },
    { label: 'My Applications', href: '/applications', icon: FileText },
  ],
  EMPLOYER: [
    { label: 'Post a Job', href: '/post-job', icon: Briefcase },
    { label: 'Hiring Dashboard', href: '/employer', icon: FileText },
  ],
  FREELANCER: [
    { label: 'Find Gigs', href: '/jobs', icon: Search },
    { label: 'My Bids', href: '/jobs', icon: FileText },
  ],
  ADMIN: [
    { label: 'Browse Jobs', href: '/jobs', icon: Search },
    { label: 'Post a Job', href: '/post-job', icon: Briefcase },
  ],
};

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  // All hooks must be registered unconditionally, before the loading-state
  // early return below (React rules-of-hooks).
  const [slots, setSlots] = useState([]);
  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    authenticatedFetch(`${base}/users/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setProfile(data))
      .catch(() => {});
  }, []);

  const loadAvailability = async () => {
    const res = await authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability`,
    );
    const data = await res.json();
    setSlots(data);
  };

  const loadSubscription = async () => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await authenticatedFetch(`${base}/subscriptions/me`);
    if (!res.ok) return;
    const data = await res.json();
    setSubscription(data ?? null);
  };

  const cancelSubscription = async () => {
    if (!subscription) return;

    try {
      setCancelling(true);
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const res = await authenticatedFetch(`${base}/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel subscription');
      await loadSubscription();
      toast.success('Your subscription will not renew after the current period ends.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription.');
    } finally {
      setCancelling(false);
      setCancelConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSlotId) return;

    try {
      setDeleting(true);

      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability/${deleteSlotId}`,
        {
          method: 'DELETE',
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      await loadAvailability();

      toast.success(data.message);
    } catch (err) {
      console.error(err);

      toast.error(err instanceof Error ? err.message : 'Failed to delete availability slot.');
    } finally {
      setDeleting(false);
      setDeleteSlotId(null);
    }
  };

useEffect(() => {
  if (ready && user) {
    void loadAvailability();
  }
}, [ready, user]);

useEffect(() => {
  if (ready && user) {
    void loadSubscription();
  }
}, [ready, user]);

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
  className: 'bg-muted/10 text-muted',
};
const actions = quickActionsByRole[user.role] ?? quickActionsByRole.JOB_SEEKER;
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
              <p className="text-xs text-muted">Go to {a.label.toLowerCase()}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">About</h2>
          {profile?.headline && <p className="mt-3 font-medium text-ink">{profile.headline}</p>}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {profile?.bio ||
              'You haven’t added a bio yet. A short summary helps employers get to know you.'}
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

      <div className="mt-8 rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Subscription</h2>
            <p className="text-sm text-muted">Your current plan and billing status.</p>
          </div>
          <Link href="/pricing" className="text-sm font-semibold text-brandGreen">
            View plans
          </Link>
        </div>
        {subscription ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-pageBg p-4">
            <div>
              <p className="font-semibold text-ink">{subscription.plan.name}</p>
              <p
                className={`text-sm font-medium ${subscriptionStatusMeta[subscription.status].className}`}
              >
                {subscriptionStatusMeta[subscription.status].label}
                {subscription.status === 'ACTIVE' &&
                  (subscription.cancelAtPeriodEnd
                    ? ` — ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : ` — renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`)}
              </p>
            </div>
            {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && (
              <button
                onClick={() => setCancelConfirmOpen(true)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-redAccent hover:bg-redAccent/10"
              >
                Cancel subscription
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            You&apos;re on the Free plan. <Link href="/pricing" className="font-semibold text-brandGreen">Upgrade anytime</Link>.
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Your Interview Availability</h2>
            <p className="text-sm text-muted">
              Add and update your available interview time slots.
            </p>
          </div>
        </div>
        <AvailabilityCard
          slots={slots}
          onRefresh={loadAvailability}
          onDelete={(id) => setDeleteSlotId(id)}
        />
      </div>
      <ConfirmDialog
        open={!!deleteSlotId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSlotId(null);
          }
        }}
        title="Delete availability slot?"
        description="This action cannot be undone. The selected interview availability time will be permanently removed."
        confirmLabel={deleting ? 'Deleting...' : 'Delete Slot'}
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => !open && setCancelConfirmOpen(false)}
        title="Cancel your subscription?"
        description="You'll keep access until the end of the period you already paid for. It won't renew after that."
        confirmLabel={cancelling ? 'Cancelling...' : 'Cancel subscription'}
        destructive
        onConfirm={cancelSubscription}
      />
    </div>
  );
}
