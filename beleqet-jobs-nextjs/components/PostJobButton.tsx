"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function PostJobButton({ className = "" }: { className?: string }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;

  const canPost = user.role === "EMPLOYER" || user.role === "ADMIN";
  if (!canPost) return null;

  return (
    <Link
      href="/post-job"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brandGreen ${className}`}
    >
      <Plus className="h-4 w-4" /> Post a Job
    </Link>
  );
}
