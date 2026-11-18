"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1>
      <p className="text-muted text-sm mt-2">We couldn’t load this page. Please try again.</p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-brandGreen text-white text-sm font-semibold px-6 py-3 hover:bg-darkGreen transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
