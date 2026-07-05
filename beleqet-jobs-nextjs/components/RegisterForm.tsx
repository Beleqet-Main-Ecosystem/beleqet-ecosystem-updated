"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { registerUser, type RegisterInput } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const roles: { value: RegisterInput["role"]; label: string }[] = [
  { value: "JOB_SEEKER", label: "Job Seeker" },
  { value: "EMPLOYER", label: "Employer" },
  { value: "FREELANCER", label: "Freelancer" },
];

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["JOB_SEEKER", "EMPLOYER", "FREELANCER"]),
});

export default function RegisterForm() {
  const router = useRouter();
  const { user, ready, setUser } = useAuth();
  const [form, setForm] = useState<RegisterInput>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "JOB_SEEKER",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from register
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
      const user = await registerUser(parsed.data);
      setUser(user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">First name</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 focus-within:border-brandGreen">
            <User className="h-4 w-4 text-muted shrink-0" />
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Henok"
              className="w-full text-sm text-ink placeholder:text-muted outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Last name</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 focus-within:border-brandGreen">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Mekonnen"
              className="w-full text-sm text-ink placeholder:text-muted outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
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
        <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 focus-within:border-brandGreen">
          <Lock className="h-4 w-4 text-muted shrink-0" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
            className="w-full text-sm text-ink placeholder:text-muted outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted hover:text-ink transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">I am a</label>
        <div className="grid grid-cols-3 gap-2">
          {roles.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setForm({ ...form, role: r.value })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                form.role === r.value
                  ? "border-brandGreen bg-brandGreen/10 text-brandGreen"
                  : "border-border bg-white text-muted hover:border-brandGreen"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brandGreen text-white text-sm font-semibold py-3 hover:bg-darkGreen transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-sm text-muted text-center">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brandGreen hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
