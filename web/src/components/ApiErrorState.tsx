'use client';

import Link from 'next/link';
import { ApiError } from '@/lib/api';

export function ApiErrorState({ error }: { error: Error }) {
  if (error instanceof ApiError && error.status === 401) {
    return (
      <div style={{ padding: 48, textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Sign in required</h2>
        <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
          Your session has expired or you are not signed in as an admin.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#1976d2',
            color: 'white',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#c62828', margin: 0 }}>You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#c62828', margin: '0 0 8px' }}>{error.message}</p>
      <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
        Make sure the backend API is running and try again.
      </p>
    </div>
  );
}
