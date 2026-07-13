'use client';

import React from 'react';

interface VerificationHeaderProps {
  currentStep: number;
  totalSteps?: number;
}

export function VerificationHeader({ currentStep, totalSteps = 3 }: VerificationHeaderProps) {
  const progress = currentStep <= totalSteps ? `${(currentStep / totalSteps) * 100}%` : '100%';

  return (
    <>
      <header className="bg-brandGreen/80 px-6 py-5 flex items-center justify-between text-white">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Identity Verification (KYC)</h1>

          <p className="mt-1 text-xs text-white/80">
            Secure identity verification for trusted freelancers
          </p>
        </div>

        <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
          Step {Math.min(currentStep, totalSteps)} of {totalSteps}
        </div>
      </header>

      {currentStep <= totalSteps && (
        <div className="h-1.5 w-full bg-gray-100">
          <div
            className="h-full bg-brandGreen transition-all duration-300 ease-in-out"
            style={{
              width: progress,
            }}
          />
        </div>
      )}
    </>
  );
}
