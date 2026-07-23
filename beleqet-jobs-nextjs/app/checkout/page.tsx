"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { authenticatedFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function CheckoutInner() {
  const { user, ready } = useAuth();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function startCheckout() {
    setStatus("loading");
    setError("");
    try {
      const response = await authenticatedFetch(`${API_URL}/subscriptions/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setError(
          Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Checkout failed.",
        );
        return;
      }
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
        return;
      }
      setStatus("error");
      setError("No approval URL returned by the payment gateway.");
    } catch {
      setStatus("error");
      setError("Cannot reach the server. Please try again.");
    }
  }

  useEffect(() => {
    if (!ready || !user || !planId || status !== "idle") return;
    startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, planId]);

  if (!planId) {
    return (
      <div className="container-page py-24 text-center text-muted">
        No plan selected.{" "}
        <Link href="/pricing" className="font-bold text-brandGreen">
          View plans
        </Link>
      </div>
    );
  }

  if (!ready) {
    return <div className="container-page py-24 text-center text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-muted">You need to sign in to subscribe.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-brandGreen"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      {status === "error" ? (
        <>
          <XCircle className="h-10 w-10 text-redAccent" />
          <p className="mt-4 max-w-md text-sm text-muted">{error}</p>
          <button
            onClick={startCheckout}
            className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-brandGreen"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-brandGreen" />
          <p className="mt-4 text-sm text-muted">
            Setting up your subscription — you&apos;ll be redirected to PayPal to approve it.
          </p>
        </>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="container-page py-24 text-center text-muted">Loading…</div>}
    >
      <CheckoutInner />
    </Suspense>
  );
}
