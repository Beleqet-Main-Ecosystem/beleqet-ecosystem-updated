'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type IdDocumentType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE';

interface FileUploadState {
  file: File | null;
  previewUrl: string | null;
}

export default function KycVerificationPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [docType, setDocType] = useState<IdDocumentType>('NATIONAL_ID');

  const [idDocument, setIdDocument] = useState<FileUploadState>({ file: null, previewUrl: null });
  const [faceScan, setFaceScan] = useState<FileUploadState>({ file: null, previewUrl: null });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'id' | 'face') => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorStatus('File size must be less than 5MB.');
      return;
    }

    setErrorStatus(null);
    const previewUrl = URL.createObjectURL(selectedFile);

    if (target === 'id') {
      setIdDocument({ file: selectedFile, previewUrl });
    } else {
      setFaceScan({ file: selectedFile, previewUrl });
    }
  };

  const triggerSubmitPipeline = async () => {
    if (!idDocument.file || !faceScan.file) {
      setErrorStatus('Please provide both your identification document and face scan.');
      return;
    }

    setIsSubmitting(true);
    setErrorStatus(null);
    setCurrentStep(4);

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      router.push('/profile?kyc_submitted=true');
    } catch (err) {
      setErrorStatus(
        'Something went wrong during submission. Please check your network and try again.',
      );
      setCurrentStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-brandGreen/80 px-6 py-4 flex justify-between items-center text-white">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Identity Verification (KYC)</h1>
            <p className="text-xs text-gray-200 mt-0.5">Secure freelance ecosystem verification</p>
          </div>
          <span className="text-sm font-medium bg-brandGreen/5 px-3 py-1 rounded-full border border-gray-100">
            Step {Math.min(currentStep, 3)} of 3
          </span>
        </div>

        {/* Step Visualizer */}
        {currentStep <= 3 && (
          <div className="w-full bg-gray-100 h-1.5 flex">
            <div
              className={`h-full bg-brandGreen/30 transition-all duration-300 ${
                currentStep === 1 ? 'w-1/3' : currentStep === 2 ? 'w-2/3' : 'w-full'
              }`}
            />
          </div>
        )}

        <div className="p-6 sm:p-8">
          {errorStatus && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
              {errorStatus}
            </div>
          )}

          {/* STEP 1: WELCOME & DOCUMENT TYPE SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-gray-600 text-sm space-y-2">
                <p>
                  To access high-value client projects and maintain a trusted network ecosystem, we
                  verify the identities of all freelancers working on Beleqet.
                </p>
                <p className="font-medium text-gray-900">
                  Your details are secure and analyzed solely for automated KYC matches.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Select Document Type
                </label>

                <div
                  onClick={() => setDocType('NATIONAL_ID')}
                  className={`p-4 border rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                    docType === 'NATIONAL_ID'
                      ? 'border-brandGreen/10 bg-brandGreen/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">National ID Card</p>
                    <p className="text-xs text-gray-500">
                      Ethiopian Kebele or Resident Digital ID card
                    </p>
                  </div>
                  <input
                    type="radio"
                    checked={docType === 'NATIONAL_ID'}
                    readOnly
                    className="h-4 w-4 text-brandGreen/10"
                  />
                </div>

                <div
                  onClick={() => setDocType('PASSPORT')}
                  className={`p-4 border rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                    docType === 'PASSPORT'
                      ? 'border-brandGreen/10 bg-brandGreen/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Passport</p>
                    <p className="text-xs text-gray-500">
                      Official International Passport booklet main page
                    </p>
                  </div>
                  <input
                    type="radio"
                    checked={docType === 'PASSPORT'}
                    readOnly
                    className="h-4 w-4 text-brandGreen/10"
                  />
                </div>

                <div
                  onClick={() => setDocType('DRIVERS_LICENSE')}
                  className={`p-4 border rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                    docType === 'DRIVERS_LICENSE'
                      ? 'border-brandGreen/10 bg-brandGreen/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Driver's License</p>
                    <p className="text-xs text-gray-500">
                      Valid government-issued driver document card
                    </p>
                  </div>
                  <input
                    type="radio"
                    checked={docType === 'DRIVERS_LICENSE'}
                    readOnly
                    className="h-4 w-4 text-brandGreen/10"
                  />
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="w-full bg-brandGreen/70 hover:bg-brandGreen/30 text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors mt-4 shadow-sm"
              >
                Continue to Document Upload
              </button>
            </div>
          )}

          {/* STEP 2: ID DOCUMENT UPLOAD */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Upload Identification Document
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Ensure all details, including text entries, legal names, and your face image are
                  clearly legible.
                </p>
              </div>

              <input
                type="file"
                ref={idInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => handleFileChange(e, 'id')}
              />

              {idDocument.previewUrl ? (
                <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-2">
                  <img
                    src={idDocument.previewUrl}
                    alt="Document Preview"
                    className="w-full h-48 object-contain rounded-lg"
                  />
                  <button
                    onClick={() => idInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-white/90 hover:bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm text-gray-700 transition-colors"
                  >
                    Replace Image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => idInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/50"
                >
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400 stroke-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    Click to upload document photo
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supports PNG, JPEG, or WEBP formats up to 5MB
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-1/3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!idDocument.file}
                  className="w-2/3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors shadow-sm"
                >
                  Next: Take Live Selfie
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SELFIE SCAN UPLOAD */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Provide Real-Time Selfie Face Scan
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Position your face clearly under decent lighting. Do not use screenshots or take
                  photos of other displays to ensure liveness analysis passes.
                </p>
              </div>

              <input
                type="file"
                ref={faceInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => handleFileChange(e, 'face')}
              />

              {faceScan.previewUrl ? (
                <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-2">
                  <img
                    src={faceScan.previewUrl}
                    alt="Face Scan Preview"
                    className="w-full h-48 object-contain rounded-lg"
                  />
                  <button
                    onClick={() => faceInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-white/90 hover:bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm text-gray-700 transition-colors"
                  >
                    Replace Image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => faceInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/50"
                >
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400 stroke-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                    />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">Click to upload selfie</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Position your face within clear, bright frame bounds
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-1/3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={triggerSubmitPipeline}
                  disabled={!faceScan.file || isSubmitting}
                  className="w-2/3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors shadow-sm"
                >
                  Submit Payload Check
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUBMITTING / PROCESSING MOCK WINDOW */}
          {currentStep === 4 && (
            <div className="py-8 text-center space-y-4">
              <div className="inline-block relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Analyzing KYC Payload Credentials
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Our identity matching engines are verifying your documentation validity patterns,
                  liveness integrity, and facial geometry ratios...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
