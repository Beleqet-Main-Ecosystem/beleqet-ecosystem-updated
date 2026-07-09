"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is invalid or incomplete.");
      return;
    }
    fetch(`${API_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        setState(response.ok ? "success" : "error");
        setMessage(data.message || (response.ok ? "Email verified successfully." : "This verification link is invalid or expired."));
      })
      .catch(() => {
        setState("error");
        setMessage("The verification service could not be reached. Please try again.");
      });
  }, []);

  return (
    <AuthShell title="Email verification" subtitle="Secure your Beleqet account.">
      <div className="space-y-5 text-center">
        <p role="status" className={`rounded-xl px-4 py-4 text-sm font-semibold ${state === "error" ? "bg-redAccent/10 text-redAccent" : "bg-brandGreen/10 text-brandGreen"}`}>{message}</p>
        {state !== "loading" && <Link href="/login" className="inline-flex rounded-full bg-brandGreen px-6 py-3 text-sm font-bold text-white">Continue to sign in</Link>}
      </div>
    </AuthShell>
  );
}
