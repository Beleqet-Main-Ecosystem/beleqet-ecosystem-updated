'use client';

import { Check } from 'lucide-react';

interface KycStepperProps {
  currentStep: number;
}

const STEPS = ['Document Type', 'Upload ID', 'Face Verification'];

export function KycStepper({ currentStep }: KycStepperProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((label, index) => {
        const step = index + 1;

        const completed = currentStep > step;

        const active = currentStep === step;

        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all

                  ${
                    completed
                      ? 'border-brandGreen bg-brandGreen text-white'
                      : active
                        ? 'border-brandGreen text-brandGreen'
                        : 'border-gray-300 text-gray-400'
                  }
                `}
              >
                {completed ? <Check className="h-5 w-5" /> : step}
              </div>

              <span
                className={`
                  mt-2 text-xs font-medium

                  ${active ? 'text-brandGreen' : 'text-gray-500'}
                `}
              >
                {label}
              </span>
            </div>

            {step !== STEPS.length && (
              <div
                className={`
                  mx-4 h-0.5 flex-1

                  ${completed ? 'bg-brandGreen' : 'bg-gray-200'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
