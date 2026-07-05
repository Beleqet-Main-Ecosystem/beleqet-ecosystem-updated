"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function JobsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-extrabold text-ink">Unable to load jobs</h1>
      <p className="text-muted text-sm mt-2">The job service is temporarily unavailable.</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-brandGreen text-white text-sm font-semibold px-6 py-3 hover:bg-darkGreen transition-colors"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-border text-ink text-sm font-semibold px-6 py-3 hover:bg-pageBg transition-colors">
          Go home
        </Link>
      </div>
    </div>
  );
}
