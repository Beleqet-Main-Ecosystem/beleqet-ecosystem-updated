'use client';

import { Loader2, ShieldCheck } from 'lucide-react';

interface KycProcessingProps {
  message?: string;
}

export function KycProcessing({
  message = 'We are verifying your identity using our secure KYC engine.',
}: KycProcessingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-brandGreen/20" />

        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brandGreen/10">
          <ShieldCheck className="h-8 w-8 text-brandGreen" />
        </div>
      </div>

      <Loader2 className="mt-6 h-8 w-8 animate-spin text-brandGreen" />

      <h2 className="mt-6 text-xl font-semibold text-gray-900">Verifying your identity</h2>

      <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">{message}</p>

      <div className="mt-8 w-full max-w-sm">
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-full animate-pulse rounded-full bg-brandGreen" />
        </div>

        <p className="mt-3 text-xs text-gray-400">This usually takes less than one minute.</p>
      </div>
    </div>
  );
}
