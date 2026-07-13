'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string | null;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />

      <p className="text-sm font-medium text-red-700">{message}</p>
    </div>
  );
}
