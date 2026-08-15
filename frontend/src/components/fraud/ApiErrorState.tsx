'use client';

import Link from 'next/link';

interface ApiErrorStateProps {
  error: Error & { status?: number };
}

export function ApiErrorState({ error }: ApiErrorStateProps) {
  if (error.status === 401) {
    return (
      <div className="mx-auto max-w-md px-12 py-12 text-center">
        <h2 className="mb-2 text-lg font-bold text-gray-800">Sign in required</h2>
        <p className="mb-5 text-sm text-gray-500 leading-relaxed">
          Your session has expired or you are not signed in as an admin.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error.status === 403) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-red-700">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <p className="mb-2 text-sm font-medium text-red-700">{error.message}</p>
      <p className="text-xs text-gray-500">Make sure the backend API is running and try again.</p>
    </div>
  );
}
