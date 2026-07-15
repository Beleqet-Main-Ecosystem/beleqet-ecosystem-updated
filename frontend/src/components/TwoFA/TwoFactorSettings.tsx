import { useState, useCallback } from 'react';
import { EnrollmentWizard } from './EnrollmentWizard';
import { OtpInput } from './OtpInput';
import { requestChallenge } from '../../utils/stepUpClient';

interface TwoFactorStatus {
  enabled: boolean;
}

interface TwoFactorSettingsProps {
  status: TwoFactorStatus;
  onRefreshStatus: () => Promise<void>;
  apiBaseUrl?: string;
}

export function TwoFactorSettings({
  status,
  onRefreshStatus,
  apiBaseUrl = '/api/v1',
}: TwoFactorSettingsProps) {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleEnroll = async () => {
    const res = await fetch(`${apiBaseUrl}/auth/2fa/enroll`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to start enrollment');
    }
    return res.json();
  };

  const handleConfirm = async (enrollmentToken: string, code: string) => {
    const res = await fetch(`${apiBaseUrl}/auth/2fa/confirm`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enrollmentToken, code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to confirm enrollment');
    }
    return res.json();
  };

  const handleEnrollmentComplete = async () => {
    setShowEnrollment(false);
    await onRefreshStatus();
  };

  const handleDisable = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/2fa/disable`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to disable');
      }
      setCode('');
      setShowDisable(false);
      setMessage('Two-factor authentication disabled.');
      await onRefreshStatus();
    } catch (err: any) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegenerate = useCallback(async () => {
    setShowRegenerate(true);
    setError(null);
    try {
      const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!accessToken) throw new Error('Not authenticated');
      const token = await requestChallenge(apiBaseUrl, accessToken, 'regenerate_backup_codes');
      setChallengeToken(token);
    } catch (err: any) {
      setError(err?.message || 'Failed to start verification');
      setShowRegenerate(false);
    }
  }, [apiBaseUrl]);

  const handleRegenerate = async () => {
    if (code.length !== 6 || !challengeToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/2fa/backup-codes/regenerate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ stepUpToken: challengeToken, code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to regenerate');
      }
      const data = await res.json();
      setCode('');
      setShowRegenerate(false);
      setChallengeToken(null);
      const codesText = data.backupCodes.join('\n');
      await navigator.clipboard.writeText(codesText);
      setMessage('New backup codes generated and copied to clipboard.');
    } catch (err: any) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (showEnrollment) {
    return (
      <EnrollmentWizard
        onEnroll={handleEnroll}
        onConfirm={handleConfirm}
        onComplete={handleEnrollmentComplete}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>

      {message && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded mb-4 text-sm">{message}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Authenticator App</p>
            <p className="text-sm text-gray-600">
              {status.enabled
                ? 'Two-factor authentication is active'
                : 'Add an extra layer of security'}
            </p>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${status.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
          />
        </div>
      </div>

      {!status.enabled && (
        <button
          onClick={() => setShowEnrollment(true)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Set up Two-Factor Authentication
        </button>
      )}

      {status.enabled && (
        <div className="space-y-3">
          <button
            onClick={handleOpenRegenerate}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Regenerate Backup Codes
          </button>
          <button
            onClick={() => setShowDisable(true)}
            className="w-full bg-red-50 text-red-700 py-2 px-4 rounded-lg hover:bg-red-100 transition-colors"
          >
            Disable Two-Factor Authentication
          </button>
        </div>
      )}

      {showDisable && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-3">
            Enter your current code to disable two-factor authentication.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => { setShowDisable(false); setCode(''); setError(null); }}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleDisable}
              disabled={code.length !== 6 || loading}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable'}
            </button>
          </div>
        </div>
      )}

      {showRegenerate && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-3">
            Enter your current code to regenerate backup codes.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => { setShowRegenerate(false); setCode(''); setChallengeToken(null); setError(null); }}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={code.length !== 6 || loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
