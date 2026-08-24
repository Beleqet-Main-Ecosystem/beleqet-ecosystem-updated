'use client';

import { useCallback, useRef, useState } from 'react';
import { CheckCircle, Loader2, UploadCloud, XCircle } from 'lucide-react';
import {
  createManualPayment,
  submitManualPaymentReceipt,
  type ManualPaymentRecord,
} from '@/lib/api';

type UploadState = 'idle' | 'creating' | 'uploading' | 'success' | 'error';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ManualPaymentPage() {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [result, setResult] = useState<ManualPaymentRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      setFileError(null);

      if (!selected) {
        setFile(null);
        return;
      }
      if (!ALLOWED_TYPES.includes(selected.type)) {
        setFileError('Invalid file type. Please upload a JPG, PNG, or PDF.');
        setFile(null);
        return;
      }
      if (selected.size > MAX_SIZE_BYTES) {
        setFileError('File exceeds the 5 MB size limit.');
        setFile(null);
        return;
      }
      setFile(selected);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) {
        setFileError('Please select a receipt file.');
        return;
      }

      setErrorMsg(null);

      try {
        // Step 1 — create the pending payment record
        setState('creating');
        const parsedAmount = Math.round(parseFloat(amount) * 100); // store in minor units
        const payment = await createManualPayment(parsedAmount, currency);

        // Step 2 — upload receipt + reference
        setState('uploading');
        const updated = await submitManualPaymentReceipt(
          payment.id,
          reference.trim(),
          file,
        );

        setResult(updated);
        setState('success');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setErrorMsg(message);
        setState('error');
      }
    },
    [amount, currency, reference, file],
  );

  if (state === 'success' && result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md text-center">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-500" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold text-gray-800">
            Payment Details Submitted
          </h1>
          <p className="mb-6 text-gray-500">
            Your receipt and transaction reference have been received. Our team
            will verify and confirm your payment within 1–2 business days.
          </p>
          <dl className="mb-6 divide-y rounded-xl border text-left text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="font-medium text-gray-600">Payment ID</dt>
              <dd className="font-mono text-gray-800">{result.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="font-medium text-gray-600">Reference</dt>
              <dd className="text-gray-800">{result.transactionReference}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="font-medium text-gray-600">Status</dt>
              <dd className="capitalize text-yellow-600">{result.status.toLowerCase()}</dd>
            </div>
          </dl>
          <button
            onClick={() => {
              setState('idle');
              setResult(null);
              setFile(null);
              setReference('');
              setAmount('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit Another Payment
          </button>
        </div>
      </div>
    );
  }

  const isLoading = state === 'creating' || state === 'uploading';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-bold text-gray-800">
          Manual Bank Transfer Payment
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Complete your payment by uploading your bank transfer receipt and
          providing the transaction reference number.
        </p>

        {state === 'error' && errorMsg && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Amount */}
          <div>
            <label
              htmlFor="amount"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Amount
            </label>
            <div className="flex gap-2">
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isLoading}
                placeholder="e.g. 1500"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isLoading}
                aria-label="Currency"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="ETB">ETB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Transaction Reference */}
          <div>
            <label
              htmlFor="reference"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Transaction Reference Number
            </label>
            <input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your bank/mobile-money reference"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label
              htmlFor="receipt"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Upload Payment Receipt
            </label>
            <label
              htmlFor="receipt"
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors ${
                isLoading
                  ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <UploadCloud
                className={`mb-2 h-8 w-8 ${isLoading ? 'text-gray-300' : 'text-gray-400'}`}
                aria-hidden="true"
              />
              {file ? (
                <span className="text-sm font-medium text-gray-700">{file.name}</span>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-600">
                    Click to select a file
                  </span>
                  <span className="mt-1 text-xs text-gray-400">
                    JPG, PNG or PDF — max 5 MB
                  </span>
                </>
              )}
              <input
                id="receipt"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                disabled={isLoading}
                className="sr-only"
              />
            </label>
            {fileError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {fileError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !amount || !reference || !file}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {state === 'creating'
              ? 'Creating payment…'
              : state === 'uploading'
              ? 'Uploading receipt…'
              : 'Submit Payment Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
