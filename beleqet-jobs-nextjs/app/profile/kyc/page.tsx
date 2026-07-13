'use client';

import { useRouter } from 'next/navigation';

import { KycStepper } from '@/components/kyc/KycStepper';
import { VerificationHeader } from '@/components/kyc/VerificationHeader';
import { FileUploadCard } from '@/components/kyc/FileUploadCard';
import { CameraCapture } from '@/components/kyc/CameraCapture';
import { KycProcessing } from '@/components/kyc/KycProcessing';
import { ErrorAlert } from '@/components/kyc/ErrorAlert';

import { useKyc } from '@/hooks/useKyc';

export default function KycVerificationPage() {
  const router = useRouter();

  const {
    currentStep,
    documentType,
    setDocumentType,
    idDocument,
    faceScan,
    setFaceScan,
    idInputRef,
    error,
    isSubmitting,
    handleFileChange,
    submitVerification,
    goNext,
    goBack,
  } = useKyc();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <section className=" mx-auto max-w-xl rounded-2xl  border bg-white p-6 shadow-sm">
        <VerificationHeader currentStep={currentStep} />

        <KycStepper currentStep={currentStep} />

        {error && <ErrorAlert message={error} />}

        {/* STEP 1 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Choose identification document</h2>

              <p className="text-sm text-gray-500">Select the document you want to verify.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  value: 'NATIONAL_ID',
                  label: 'National ID',
                },

                {
                  value: 'PASSPORT',
                  label: 'Passport',
                },

                {
                  value: 'DRIVERS_LICENSE',
                  label: "Driver's License",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setDocumentType(item.value as typeof documentType)}
                  className={` w-full rounded-xl border p-4 text-left transition
                    ${
                      documentType === item.value
                        ? 'border-brandGreen bg-brandGreen/5'
                        : 'border-gray-200 hover:border-gray-400'
                    }
                  `}
                >
                  <p className="font-medium">{item.label}</p>
                </button>
              ))}
            </div>

            <button
              onClick={goNext}
              className="w-full rounded-xl bg-brandGreen py-3 text-white font-medium
              "
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <FileUploadCard
              title="Identity Document"
              description="
              Upload a clear image of your ID document.
              "
              previewUrl={idDocument.previewUrl}
              inputRef={idInputRef}
              accept="
              image/png,image/jpeg,image/webp
              "
              onFileSelected={(event) => handleFileChange(event, 'id')}
            />

            <div className="flex gap-3">
              <button
                onClick={goBack}
                className="flex-1 rounded-xl  border border-gray-200 bg-white py-3 font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95"
              >
                Back
              </button>

              <button
                disabled={!idDocument.file}
                onClick={goNext}
                className="flex-1 rounded-xl bg-green-600 py-3 font-medium text-white shadow-sm transition-all duration-200 hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {!faceScan.file ? (
              <CameraCapture
                onCapture={(file) => {
                  console.log('PAGE RECEIVED FILE:', file);

                  setFaceScan({
                    file,
                    previewUrl: URL.createObjectURL(file),
                  });
                }}
                onCancel={goBack}
              />
            ) : (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-xl border">
                  <img
                    src={faceScan.previewUrl!}
                    alt="Captured selfie"
                    className="h-72 w-full object-cover"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFaceScan({
                      file: null,
                      previewUrl: null,
                    });
                  }}
                  className=" w-full rounded-xl border py-3
          "
                >
                  Retake Selfie
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                disabled={isSubmitting}
                onClick={goBack}
                className="flex-1 rounded-xl border py-3"
              >
                Back
              </button>

              <button
                disabled={!faceScan.file || isSubmitting}
                onClick={submitVerification}
                className=" flex-1 rounded-xl bg-brandGreen py-3 text-white disabled:opacity-40 "
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 */}

        {currentStep === 4 && <KycProcessing />}
      </section>
    </main>
  );
}
