'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  FileCheck,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
  XCircle,
  Building2,
  Smartphone,
  CreditCard,
} from 'lucide-react';
import {
  createManualPayment,
  submitManualPaymentReceipt,
  type ManualPaymentRecord,
} from '@/lib/api';

type UploadState = 'idle' | 'creating' | 'uploading' | 'success' | 'error';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const BANK_ACCOUNTS = [
  {
    name: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '1000234567891',
    holder: 'Beleqet Technologies PLC',
    icon: Building2,
    badge: 'CBE Birr / CBE',
  },
  {
    name: 'Telebirr SuperApp',
    accountNumber: '0911223344',
    holder: 'Beleqet Jobs',
    icon: Smartphone,
    badge: 'Mobile Money',
  },
  {
    name: 'Awash International Bank',
    accountNumber: '01304567890100',
    holder: 'Beleqet Technologies PLC',
    icon: CreditCard,
    badge: 'Awash Online',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ManualPaymentPage() {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [result, setResult] = useState<ManualPaymentRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      setIsAuthenticated(Boolean(token));
    }
  }, []);

  const handleCopy = (accNo: string) => {
    navigator.clipboard.writeText(accNo).then(() => {
      setCopiedAccount(accNo);
      setTimeout(() => setCopiedAccount(null), 2000);
    });
  };

  const validateAndSetFile = useCallback((selected: File | null) => {
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
      setFileError('File exceeds the 5 MB maximum size limit.');
      setFile(null);
      return;
    }
    setFile(selected);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      validateAndSetFile(selected);
    },
    [validateAndSetFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(dropped);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) {
        setFileError('Please select or drop a receipt file before submitting.');
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        setErrorMsg('Please specify a valid payment amount.');
        return;
      }
      if (!reference.trim()) {
        setErrorMsg('Please enter your transaction reference number.');
        return;
      }

      setErrorMsg(null);

      try {
        // Step 1 - create the pending payment record
        setState('creating');
        const parsedAmount = Math.round(parseFloat(amount) * 100); // store in minor units (cents)
        const payment = await createManualPayment(parsedAmount, currency);

        // Step 2 - upload receipt + reference
        setState('uploading');
        const updated = await submitManualPaymentReceipt(
          payment.id,
          reference.trim(),
          file,
        );

        setResult(updated);
        setState('success');
      } catch (err) {
        let message = 'An unexpected error occurred while processing your submission.';
        if (axios.isAxiosError(err)) {
          message =
            err.response?.data?.message ||
            (err.response?.data && typeof err.response.data === 'string'
              ? err.response.data
              : err.message);
        } else if (err instanceof Error) {
          message = err.message;
        }
        setErrorMsg(message);
        setState('error');
      }
    },
    [amount, currency, reference, file],
  );

  // Success view
  if (state === 'success' && result) {
    return (
      <div className="payment-portal-wrapper">
        <div className="payment-portal-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <CheckCircle size={36} />
          </div>

          <h1 className="payment-portal-title" style={{ fontSize: 24 }}>
            Payment Receipt Submitted
          </h1>
          <p className="payment-portal-subtitle" style={{ maxWidth: 440, margin: '0 auto 24px' }}>
            Your bank transfer receipt and reference code have been securely registered.
            Our finance team will verify the bank transaction and approve your payment shortly.
          </p>

          <div className="receipt-summary-table">
            <div className="receipt-summary-row">
              <span className="receipt-summary-label">Payment ID</span>
              <span className="receipt-summary-value" style={{ fontFamily: 'monospace' }}>
                {result.id}
              </span>
            </div>
            <div className="receipt-summary-row">
              <span className="receipt-summary-label">Reference Code</span>
              <span className="receipt-summary-value" style={{ fontFamily: 'monospace' }}>
                {result.transactionReference}
              </span>
            </div>
            <div className="receipt-summary-row">
              <span className="receipt-summary-label">Amount</span>
              <span className="receipt-summary-value">
                {new Intl.NumberFormat('en-ET', {
                  style: 'currency',
                  currency: result.currency,
                }).format(result.amount / 100)}
              </span>
            </div>
            <div className="receipt-summary-row">
              <span className="receipt-summary-label">Verification Status</span>
              <span className="badge badge-pending">PENDING VERIFICATION</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <button
              onClick={() => {
                setState('idle');
                setResult(null);
                setFile(null);
                setReference('');
                setAmount('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Submit Another Payment
            </button>

            <Link href="/" className="btn btn-ghost" style={{ width: '100%' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = state === 'creating' || state === 'uploading';

  return (
    <div className="payment-portal-wrapper">
      <div className="payment-portal-card">
        {/* Header */}
        <div className="payment-portal-header">
          <div className="payment-portal-badge">
            <ShieldCheck size={14} />
            <span>Secure Manual Transfer</span>
          </div>
          <h1 className="payment-portal-title">Bank Transfer Payment</h1>
          <p className="payment-portal-subtitle">
            Deposit or transfer funds directly to any of our registered accounts below,
            then upload your transaction receipt for immediate verification.
          </p>
        </div>

        {/* Bank Instructions Card */}
        <div className="bank-instructions-box">
          <div className="bank-instructions-title">
            <Building2 size={16} />
            <span>Official Bank & Mobile Accounts</span>
          </div>

          <div className="bank-list">
            {BANK_ACCOUNTS.map((bank) => {
              const Icon = bank.icon;
              const isCopied = copiedAccount === bank.accountNumber;
              return (
                <div key={bank.name} className="bank-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-blue)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="bank-item-left">
                      <span className="bank-item-name">{bank.name}</span>
                      <span className="bank-item-details">
                        {bank.accountNumber} • <span style={{ color: 'var(--text-muted)' }}>{bank.holder}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(bank.accountNumber)}
                    className="copy-pill"
                    title="Copy account number"
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ color: 'var(--accent-green)' }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth Notice (if not logged in) */}
        {isAuthenticated === false && (
          <div className="alert-box alert-box-warning" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Note: </strong>
              You are currently submitting as a guest. To automatically attach this transaction to
              your account history,{' '}
              <Link href="/login" style={{ color: 'var(--accent-amber)', fontWeight: 600, textDecoration: 'underline' }}>
                sign in to your account
              </Link>{' '}
              before submitting.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {state === 'error' && errorMsg && (
          <div className="alert-box alert-box-error" role="alert">
            <XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button
              onClick={() => setErrorMsg(null)}
              className="btn btn-ghost"
              style={{ padding: 4, minHeight: 0 }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Amount & Currency */}
          <div className="form-group">
            <label htmlFor="amount" className="form-label">
              Transferred Amount
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isLoading}
                placeholder="e.g. 2500"
                style={{ flex: 1 }}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isLoading}
                style={{ width: 110 }}
                aria-label="Currency"
              >
                <option value="ETB">ETB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Reference Number */}
          <div className="form-group">
            <label htmlFor="reference" className="form-label">
              Bank / Mobile Money Reference Code
            </label>
            <input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              disabled={isLoading}
              placeholder="e.g. FT23281XXXXX or CBE transaction number"
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Enter the unique reference code from your bank SMS, deposit slip, or Telebirr notification.
            </div>
          </div>

          {/* Receipt File Upload */}
          <div className="form-group">
            <label className="form-label">
              Upload Deposit Slip or Receipt (Image or PDF)
            </label>

            <div
              className={`dropzone-container ${isDragOver ? 'is-dragover' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                id="receipt"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                disabled={isLoading}
                style={{ display: 'none' }}
              />

              <div className="dropzone-icon">
                {file ? <FileCheck size={22} style={{ color: 'var(--accent-green)' }} /> : <UploadCloud size={22} />}
              </div>

              <div className="dropzone-title">
                {file ? 'File Selected' : 'Drag & drop your receipt, or browse'}
              </div>
              <div className="dropzone-hint">
                Supports JPG, PNG or PDF files up to 5 MB
              </div>
            </div>

            {/* Selected File Details */}
            {file && (
              <div className="file-selected-box">
                <div className="file-selected-info">
                  <FileText size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                  <div>
                    <div className="file-selected-name">{file.name}</div>
                    <div className="file-selected-size">{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px', fontSize: 12, gap: 4 }}
                  title="Remove file"
                >
                  <X size={14} />
                  <span>Remove</span>
                </button>
              </div>
            )}

            {fileError && (
              <div style={{ fontSize: 12, color: 'var(--accent-rose)', marginTop: 6 }}>
                {fileError}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !amount || !reference || !file}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px 20px', marginTop: 12, gap: 8 }}
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {state === 'creating'
              ? 'Initiating payment record…'
              : state === 'uploading'
              ? 'Uploading receipt and verifying…'
              : 'Submit Payment for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
