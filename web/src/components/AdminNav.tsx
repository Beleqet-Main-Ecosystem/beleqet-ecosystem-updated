'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ACTIVE = '#e94560';
const INACTIVE = '#ccc';

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? ACTIVE : INACTIVE,
    textDecoration: 'none',
    fontWeight: active ? 600 : 400,
  };
}

export function AdminNav() {
  const pathname = usePathname();

  const fraudRulesActive = pathname.startsWith('/admin/fraud/rules');
  const fraudAlertsActive =
    pathname.startsWith('/admin/fraud') && !fraudRulesActive;
  const loginActive = pathname.startsWith('/login');

  return (
    <nav
      style={{
        background: '#1a1a2e',
        color: 'white',
        padding: '12px 24px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '18px' }}>Beleqet Admin</span>
      <Link href="/admin/fraud" style={navLinkStyle(fraudAlertsActive)}>
        Fraud Alerts
      </Link>
      <Link href="/admin/fraud/rules" style={navLinkStyle(fraudRulesActive)}>
        Fraud Rules
      </Link>
      <Link href="/login" style={{ ...navLinkStyle(loginActive), marginLeft: 'auto' }}>
        Login
      </Link>
    </nav>
  );
}
