import { useState, useRef } from 'react';
import { StepUpModal } from '../TwoFA/StepUpModal';

interface PasswordChangeFormProps {
  apiBaseUrl?: string;
  onSuccess?: () => void;
}

export function PasswordChangeForm({
  apiBaseUrl = '/api/v1',
  onSuccess,
}: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showStepUp, setShowStepUp] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<string | null>(null);

  const stepUpSuccessRef = useRef<((stepUpToken: string) => Promise<void>) | null>(null);

  const getAccessToken = () => localStorage.getItem('accessToken');

  const validate = (): string | null => {
    if (!currentPassword) return 'Current password is required';
    if (!newPassword) return 'New password is required';
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    if (newPassword === currentPassword) return 'New password must be different from current';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.requiresStepUp) {
          stepUpSuccessRef.current = async (stepUpToken: string) => {
            const retryRes = await fetch(`${apiBaseUrl}/auth/change-password`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'x-step-up-token': stepUpToken,
              },
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            if (!retryRes.ok) {
              const errData = await retryRes.json();
              throw new Error(errData.message || 'Failed to change password');
            }
            setSuccessMessage('Password changed successfully. You are being logged out...');
            localStorage.removeItem('accessToken');
            if (onSuccess) {
              setTimeout(onSuccess, 2000);
            } else {
              setTimeout(() => { window.location.href = '/login'; }, 2000);
            }
          };
          setStepUpChallenge(data.stepUpToken);
          setShowStepUp(true);
          return;
        }
        throw new Error(data.message || 'Unauthorized');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to change password');
      }

      setSuccessMessage('Password changed successfully. You are being logged out...');
      localStorage.removeItem('accessToken');
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      } else {
        setTimeout(() => { window.location.href = '/login'; }, 2000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleStepUpVerify = async (code: string): Promise<string> => {
    const accessToken = getAccessToken();
    const res = await fetch(`${apiBaseUrl}/auth/2fa/step-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ stepUpToken: stepUpChallenge, code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Step-up verification failed');
    }
    const data = await res.json();
    return data.stepUpToken;
  };

  const handleStepUpSuccess = async (stepUpToken: string) => {
    try {
      await stepUpSuccessRef.current?.(stepUpToken);
    } catch (err: any) {
      setError(err?.message || 'Operation failed');
    } finally {
      setShowStepUp(false);
      setStepUpChallenge(null);
      stepUpSuccessRef.current = null;
    }
  };

  const handleStepUpClose = () => {
    setShowStepUp(false);
    setStepUpChallenge(null);
    stepUpSuccessRef.current = null;
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Change Password</h2>

      {successMessage && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded mb-4 text-sm">{successMessage}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      <StepUpModal
        isOpen={showStepUp}
        onClose={handleStepUpClose}
        onVerify={handleStepUpVerify}
        onSuccess={handleStepUpSuccess}
        title="Confirm Password Change"
        description="Enter your 2FA code to authorize changing your password."
      />
    </div>
  );
}
