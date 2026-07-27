"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type SubscriptionStatus = "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

/**
 * PayPal's return_url after the payer approves a checkout or subscription
 * (see PAYPAL_RETURN_URL). Activation itself happens asynchronously via
 * PayPal's webhook, so this page polls briefly for the subscription to
 * flip to ACTIVE rather than assuming success from the redirect alone.
 */
export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<SubscriptionStatus | "unknown">("unknown");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= 5 || status === "ACTIVE") return;
    const timeout = setTimeout(async () => {
      const response = await authenticatedFetch(`${API_URL}/subscriptions/me`);
      if (response.ok) {
        const data = await response.json();
        if (data?.status) setStatus(data.status);
      }
      setAttempts((n) => n + 1);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [attempts, status]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      {status === "ACTIVE" ? (
        <>
          <CheckCircle2 className="h-12 w-12 text-brandGreen" />
          <h1 className="mt-4 text-2xl font-black text-primary">Subscription active</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            Thanks — your plan is now active. Manage it anytime from your profile.
          </p>
        </>
      ) : attempts >= 5 ? (
        <>
          <h1 className="text-2xl font-black text-primary">Payment received</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            We&apos;re still confirming your subscription with the payment gateway. This can take a
            minute — check your profile shortly.
          </p>
        </>
      ) : (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-brandGreen" />
          <p className="mt-4 text-sm text-muted">Confirming your subscription…</p>
        </>
      )}
      <Link
        href="/profile"
        className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-brandGreen"
      >
        Go to my profile
      </Link>
    </div>
  );
}
