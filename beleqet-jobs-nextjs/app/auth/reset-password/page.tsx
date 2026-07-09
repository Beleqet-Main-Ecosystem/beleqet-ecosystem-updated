"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setMessage("This reset link is invalid or incomplete.");
      setLoading(false);
      return;
    }
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await response.json().catch(() => ({}));
    setSuccess(response.ok);
    setMessage(data.message || (response.ok ? "Password reset successfully." : "The reset link is invalid or expired."));
    setLoading(false);
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least eight characters and avoid passwords used elsewhere.">
      {success ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-brandGreen/10 px-4 py-3 text-sm font-semibold text-brandGreen">{message}</p>
          <Link href="/login" className="inline-flex rounded-full bg-brandGreen px-6 py-3 text-sm font-bold text-white">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-ink">New password
            <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="mt-1.5 w-full rounded-xl border border-border px-3.5 py-3 text-sm outline-none focus:border-brandGreen" />
          </label>
          {message && <p role="alert" className="rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent">{message}</p>}
          <button disabled={loading} className="w-full rounded-full bg-brandGreen py-3 text-sm font-bold text-white hover:bg-darkGreen disabled:opacity-60">{loading ? "Updating…" : "Update password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
