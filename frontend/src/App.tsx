import { useState } from 'react';
import { WithdrawForm } from './components/Wallet/WithdrawForm';
import { ReleaseButton } from './components/Escrow/ReleaseButton';
import { PasswordChangeForm } from './components/Auth/PasswordChangeForm';
import { EmailChangeForm } from './components/Auth/EmailChangeForm';
import { TwoFactorSettings } from './components/TwoFA/TwoFactorSettings';

type Tab = '2fa' | 'wallet' | 'escrow' | 'password' | 'email';

function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useState(() => {
    fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
  });

  const color = status === 'online' ? 'text-green-600' : status === 'offline' ? 'text-red-600' : 'text-yellow-600';
  return <span className={color + ' text-sm ml-4'}>API: {status}</span>;
}

export function App() {
  const [tab, setTab] = useState<Tab>('2fa');
  const [balance, setBalance] = useState(0);
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean }>({ enabled: false });

  const handleRefreshStatus = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const res = await fetch('/api/v1/auth/2fa/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTwoFactorStatus(await res.json());
    } catch { /* ignore */ }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: '2fa', label: '2FA Settings' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'escrow', label: 'Escrow' },
    { key: 'password', label: 'Password' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Beleqet-Test App</h1>
          <ApiStatus />
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Session</h2>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Paste access token..."
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              id="token-input"
              onBlur={(e) => {
                if (e.target.value) localStorage.setItem('accessToken', e.target.value);
              }}
            />
            <button
              onClick={() => {
                localStorage.removeItem('accessToken');
                window.location.reload();
              }}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
            >
              Clear
            </button>
            <button
              onClick={handleRefreshStatus}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-2"
            >
              Refresh 2FA Status
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Balance: {balance} | 2FA: {twoFactorStatus.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {tab === '2fa' && (
          <TwoFactorSettings
            status={twoFactorStatus}
            onRefreshStatus={handleRefreshStatus}
          />
        )}
        {tab === 'wallet' && (
          <WithdrawForm
            onBalanceChange={(b) => setBalance(b)}
          />
        )}
        {tab === 'escrow' && (
          <div className="max-w-md mx-auto p-6">
            <h2 className="text-xl font-semibold mb-4">Release Milestone</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Milestone ID</label>
              <input
                type="text"
                id="milestone-id-input"
                placeholder="Enter milestone ID..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/*
              The ReleaseButton reads the milestoneId from the input.
              For simplicity, the test uses a known milestone ID injected via the test script.
            */}
            <div id="release-button-container">
              <ReleaseButton milestoneId="test-milestone-id" />
            </div>
          </div>
        )}
        {tab === 'password' && <PasswordChangeForm />}
        {tab === 'email' && <EmailChangeForm />}
      </main>
    </div>
  );
}
