"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || (response.ok ? "Check your email for a reset link." : "The request could not be completed."));
    setLoading(false);
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we’ll send a secure reset link.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-ink">
          Email address
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-border px-3.5 py-3 text-sm outline-none focus:border-brandGreen" />
        </label>
        {message && <p role="status" className="rounded-xl bg-brandGreen/10 px-4 py-3 text-sm font-semibold text-brandGreen">{message}</p>}
        <button disabled={loading} className="w-full rounded-full bg-brandGreen py-3 text-sm font-bold text-white hover:bg-darkGreen disabled:opacity-60">
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/login" className="block text-center text-sm font-semibold text-brandGreen hover:underline">Back to sign in</Link>
      </form>
    </AuthShell>
  );
}
