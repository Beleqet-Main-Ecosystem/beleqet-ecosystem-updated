"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PortfolioAuthModalProps = {
  open: boolean;
  onClose: () => void;
  message?: string;
};

/**
 * Authentication gate shown when anonymous users attempt save/export/publish.
 */
export function PortfolioAuthModal({
  open,
  onClose,
  message = "Sign in to save, export, or publish your portfolio.",
}: PortfolioAuthModalProps) {
  if (!open) return null;

  const next = encodeURIComponent("/portfolio");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-auth-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="portfolio-auth-title"
              className="text-lg font-extrabold text-primary"
            >
              Sign in required
            </h2>
            <p className="mt-1 text-sm text-ink/70">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink/50 hover:bg-primary/5"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/login?next=${next}`}
            className={cn(
              buttonVariants(),
              "flex-1 justify-center rounded-xl py-2.5",
            )}
          >
            Sign in
          </Link>
          <Link
            href={`/register?next=${next}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex-1 justify-center rounded-xl py-2.5",
            )}
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
