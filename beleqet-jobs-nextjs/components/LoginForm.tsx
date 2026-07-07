"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { loginUser } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginForm() {
  const router = useRouter();
  const { user, ready, setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from login
  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  if (ready && user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(parsed.data);
      setUser(user);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-redAccent/30 bg-redAccent/10 text-redAccent text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Email
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 focus-within:border-brandGreen">
          <Mail className="h-4 w-4 text-muted shrink-0" />
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full text-sm text-ink placeholder:text-muted outline-none"
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-sm font-medium text-ink">Password</label>
          <Link href="/forgot-password" className="text-xs font-semibold text-brandGreen hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 focus-within:border-brandGreen">
          <Lock className="h-4 w-4 text-muted shrink-0" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your password"
            className="w-full text-sm text-ink placeholder:text-muted outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted hover:text-ink transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brandGreen text-white text-sm font-semibold py-3 hover:bg-darkGreen transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-sm text-muted text-center">
        Don’t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-brandGreen hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
