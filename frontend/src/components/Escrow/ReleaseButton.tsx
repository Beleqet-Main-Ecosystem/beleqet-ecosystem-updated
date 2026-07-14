import { useState, useRef } from 'react';
import { StepUpModal } from '../TwoFA/StepUpModal';

interface ReleaseButtonProps {
  apiBaseUrl?: string;
  milestoneId: string;
  onSuccess?: () => void;
}

export function ReleaseButton({
  apiBaseUrl = '/api/v1',
  milestoneId,
  onSuccess,
}: ReleaseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showStepUp, setShowStepUp] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<string | null>(null);

  const stepUpSuccessRef = useRef<((stepUpToken: string) => Promise<void>) | null>(null);

  const getAccessToken = () => localStorage.getItem('accessToken');

  const handleRelease = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(`${apiBaseUrl}/escrow/milestones/${milestoneId}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.requiresStepUp) {
          stepUpSuccessRef.current = async (stepUpToken: string) => {
            const retryRes = await fetch(`${apiBaseUrl}/escrow/milestones/${milestoneId}/release`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'x-step-up-token': stepUpToken,
              },
            });
            if (!retryRes.ok) {
              const errData = await retryRes.json();
              throw new Error(errData.message || 'Release failed');
            }
            setSuccessMessage('Milestone released successfully.');
            onSuccess?.();
          };
          setStepUpChallenge(data.stepUpToken);
          setShowStepUp(true);
          return;
        }
        throw new Error(data.message || 'Unauthorized');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Release failed');
      }

      setSuccessMessage('Milestone released successfully.');
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Release failed');
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
    <div>
      {successMessage && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded mb-4 text-sm">{successMessage}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      <button
        onClick={handleRelease}
        disabled={loading}
        className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Releasing...' : 'Release Milestone'}
      </button>

      <StepUpModal
        isOpen={showStepUp}
        onClose={handleStepUpClose}
        onVerify={handleStepUpVerify}
        onSuccess={handleStepUpSuccess}
        title="Confirm Milestone Release"
        description="Enter your 2FA code to authorize this milestone release."
      />
    </div>
  );
}
