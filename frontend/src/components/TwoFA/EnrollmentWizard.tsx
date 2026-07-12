import { useState } from 'react';
import { QrCodeDisplay } from './QrCodeDisplay';
import { OtpInput } from './OtpInput';

interface EnrollmentData {
  provisioningUri: string;
  enrollmentToken: string;
  secret: string;
}

interface EnrollmentWizardProps {
  onEnroll: () => Promise<EnrollmentData>;
  onConfirm: (enrollmentToken: string, code: string) => Promise<{ backupCodes: string[] }>;
  onComplete: () => void;
}

type Step = 'intro' | 'qr' | 'confirm' | 'backup-codes' | 'done';

export function EnrollmentWizard({ onEnroll, onConfirm, onComplete }: EnrollmentWizardProps) {
  const [step, setStep] = useState<Step>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onEnroll();
      setEnrollmentData(data);
      setStep('qr');
    } catch (err: any) {
      setError(err?.message || 'Failed to start enrollment');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!enrollmentData || code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onConfirm(enrollmentData.enrollmentToken, code);
      setBackupCodes(result.backupCodes);
      setStep('backup-codes');
    } catch (err: any) {
      setError(err?.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 3000);
  };

  const handleDone = () => {
    setStep('done');
    onComplete();
  };

  if (step === 'intro') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
        <p className="text-gray-600 mb-6">
          Add an extra layer of security to your account. You will need to enter a
          code from your authenticator app every time you sign in.
        </p>
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
        )}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Setting up...' : 'Set up Two-Factor Authentication'}
        </button>
      </div>
    );
  }

  if (step === 'qr' && enrollmentData) {
    return (
      <div className="max-w-md mx-auto p-6">
        <QrCodeDisplay
          provisioningUri={enrollmentData.provisioningUri}
          secret={enrollmentData.secret}
        />
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Authentication code
          </label>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded mt-3 text-sm">{error}</div>
          )}
          <button
            onClick={handleConfirm}
            disabled={code.length !== 6 || loading}
            className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'backup-codes') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-semibold mb-2">Save your backup codes</h2>
        <p className="text-sm text-gray-600 mb-4">
          Each code can be used only once. Store them in a safe place. If you lose
          your authenticator device, you will need these codes to access your account.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((code, i) => (
              <div key={i} className="bg-white px-3 py-2 rounded border border-gray-100 text-center">
                {code}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCopyCodes}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {codesCopied ? 'Copied!' : 'Copy Codes'}
          </button>
          <button
            onClick={handleDone}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="text-green-500 text-5xl mb-4">✓</div>
      <h2 className="text-xl font-semibold mb-2">Two-Factor Authentication Enabled</h2>
      <p className="text-gray-600">
        Your account is now more secure. You will be prompted for a code on your next login.
      </p>
    </div>
  );
}
