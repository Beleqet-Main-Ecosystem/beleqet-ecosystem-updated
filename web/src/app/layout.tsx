import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beleqet — Fraud Alert Dashboard',
  description: 'Admin dashboard for monitoring and managing security alerts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        <nav style={{ background: '#1a1a2e', color: 'white', padding: '12px 24px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '18px' }}>Beleqet Admin</span>
          <a href="/admin/fraud" style={{ color: '#e94560', textDecoration: 'none', fontWeight: 600 }}>Fraud Alerts</a>
          <a href="/admin/fraud/rules" style={{ color: '#ccc', textDecoration: 'none' }}>Fraud Rules</a>
        </nav>
        <main style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
