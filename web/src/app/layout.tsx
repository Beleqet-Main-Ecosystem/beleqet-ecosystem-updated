import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Beleqet — Fraud Alert Dashboard',
  description: 'Admin dashboard for monitoring and managing security alerts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        <AuthProvider>
          <AdminNav />
          <main style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
