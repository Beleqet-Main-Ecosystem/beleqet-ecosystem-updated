import { useState } from 'react';
import { OtpInput } from './OtpInput';

interface StepUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<string>;
  onSuccess: (stepUpToken: string) => void;
  title?: string;
  description?: string;
}

export function StepUpModal({
  isOpen,
  onClose,
  onVerify,
  onSuccess,
  title = 'Verify your identity',
  description = 'Enter your 2FA code to authorize this action.',
}: StepUpModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const stepUpToken = await onVerify(code);
      onSuccess(stepUpToken);
      setCode('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Invalid code. Try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔐</div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Authentication code
          </label>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={code.length !== 6 || loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
}
