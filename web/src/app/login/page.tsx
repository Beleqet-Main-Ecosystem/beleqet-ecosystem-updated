'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

const DEV_EMAIL = 'admin@beleqet.local';
const DEV_PASSWORD = 'adminpassword12';
const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(isDev ? DEV_EMAIL : '');
  const [password, setPassword] = useState(isDev ? DEV_PASSWORD : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/admin/fraud');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '48px auto', background: 'white', padding: 32, borderRadius: 8 }}>
      <h1>Admin Login</h1>
      <p style={{ color: '#666', fontSize: 14 }}>Sign in with an admin account to access fraud alerts.</p>

      {isDev && (
        <div style={{ marginTop: 16, padding: 12, background: '#f0f7ff', borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
          <strong>Dev credentials</strong>
          <div>Email: <code>{DEV_EMAIL}</code></div>
          <div>Password: <code>{DEV_PASSWORD}</code></div>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: 'red', margin: 0, fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 16px', cursor: 'pointer' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 14,
};
