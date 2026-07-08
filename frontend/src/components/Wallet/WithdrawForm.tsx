import { useState, useRef } from 'react';
import { StepUpModal } from '../TwoFA/StepUpModal';

interface WithdrawFormProps {
  apiBaseUrl?: string;
  onBalanceChange?: (newBalance: number) => void;
}

export function WithdrawForm({
  apiBaseUrl = '/api/v1',
  onBalanceChange,
}: WithdrawFormProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CHAPA' | 'TELEBIRR' | 'CBE_BIRR'>('CHAPA');
  const [accountRef, setAccountRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showStepUp, setShowStepUp] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<string | null>(null);

  const stepUpSuccessRef = useRef<((stepUpToken: string) => Promise<void>) | null>(null);

  const getAccessToken = () => localStorage.getItem('accessToken');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amount || amountNum <= 0) { setError('Enter a valid amount'); return; }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(`${apiBaseUrl}/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ amount: amountNum, method, accountRef }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.requiresStepUp) {
          stepUpSuccessRef.current = async (stepUpToken: string) => {
            const retryRes = await fetch(`${apiBaseUrl}/wallet/withdraw`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'x-step-up-token': stepUpToken,
              },
              body: JSON.stringify({ amount: amountNum, method, accountRef }),
            });
            if (!retryRes.ok) {
              const errData = await retryRes.json();
              throw new Error(errData.message || 'Withdrawal failed');
            }
            const result = await retryRes.json();
            setSuccessMessage(`Successfully withdrew ${amountNum}. New balance: ${result.balance}`);
            onBalanceChange?.(result.balance);
          };
          setStepUpChallenge(data.stepUpToken);
          setShowStepUp(true);
          return;
        }
        throw new Error(data.message || 'Unauthorized');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Withdrawal failed');
      }

      const result = await res.json();
      setSuccessMessage(`Successfully withdrew ${amountNum}. New balance: ${result.balance}`);
      onBalanceChange?.(result.balance);
    } catch (err: any) {
      setError(err?.message || 'Withdrawal failed');
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
      <h2 className="text-xl font-semibold mb-4">Withdraw Funds</h2>

      {successMessage && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded mb-4 text-sm">{successMessage}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ETB)</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            disabled={loading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="CHAPA">CHAPA</option>
            <option value="TELEBIRR">TELEBIRR</option>
            <option value="CBE_BIRR">CBE_BIRR</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Reference</label>
          <input
            type="text"
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value)}
            disabled={loading}
            maxLength={50}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="Phone number or account ID"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !amount || !accountRef}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing...' : 'Withdraw'}
        </button>
      </form>

      <StepUpModal
        isOpen={showStepUp}
        onClose={handleStepUpClose}
        onVerify={handleStepUpVerify}
        onSuccess={handleStepUpSuccess}
        title="Confirm Withdrawal"
        description="Enter your 2FA code to authorize this withdrawal."
      />
    </div>
  );
}
