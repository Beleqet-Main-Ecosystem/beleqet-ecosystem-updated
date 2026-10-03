'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/api';
import {
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Gavel,
  ScrollText,
  Bell,
  Settings,
  CreditCard,
  ShieldAlert,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { NotificationBell } from '@/components/Notifications';
import { ThemeToggle } from '@/components/ThemeToggle';

interface User {
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Shared admin layout - sidebar navigation + top navbar + RBAC guard.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      router.replace('/login');
      return;
    }
    let parsed: User;
    try {
      parsed = JSON.parse(storedUser);
    } catch {
      localStorage.removeItem('user');
      router.replace('/login');
      return;
    }
    if (!parsed || parsed.role !== 'ADMIN') {
      router.replace('/login');
      return;
    }
    setUser(parsed);
  }, [router]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // If the logout call fails, still clear local session and redirect.
    }
    router.replace('/login');
  }

  if (!user) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>Loading admin panel…</span>
      </div>
    );
  }

  const initials = `${user.firstName[0] || 'A'}${user.lastName[0] || 'D'}`.toUpperCase();

  const navSections = [
    {
      title: 'Analytics & Overview',
      items: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      title: 'Finance & Operations',
      items: [
        { href: '/admin/manual-payments', label: 'Manual Payments', icon: <CreditCard size={18} /> },
        { href: '/admin/disputes', label: 'Disputes', icon: <Gavel size={18} /> },
      ],
    },
    {
      title: 'Security & Activity',
      items: [
        { href: '/admin/fraud-alerts', label: 'Fraud Alerts', icon: <ShieldAlert size={18} /> },
        { href: '/admin/audit-logs', label: 'Audit Trail', icon: <ScrollText size={18} /> },
      ],
    },
    {
      title: 'Communications',
      items: [
        { href: '/admin/notifications', label: 'Notifications', icon: <Bell size={18} /> },
        { href: '/admin/email', label: 'Email Automation', icon: <Mail size={18} /> },
        {
          href: '/admin/settings/notifications',
          label: 'Notification Settings',
          icon: <Settings size={18} />,
        },
      ],
    },
  ];

  // Derive current page title for breadcrumb
  let activeTitle = 'Admin Console';
  for (const sec of navSections) {
    for (const item of sec.items) {
      if (pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))) {
        activeTitle = item.label;
      }
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="sidebar-logo-text">Beleqet</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>ADMIN PORTAL</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 12 }}>
              <div className="sidebar-section-title">{sec.title}</div>
              {sec.items.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/admin/dashboard' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={isActive ? 'active' : ''}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.firstName} {user.lastName}
            </div>
            <div className="role">{user.role}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} title="Logout" type="button" style={{ padding: '6px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content area with sticky top bar */}
      <main className="main-content">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <div className="admin-topbar-breadcrumb">
              <span>Admin</span>
              <span>/</span>
              <strong>{activeTitle}</strong>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-status-pill" title="Backend API operational on port 4000">
              <span className="admin-status-dot" />
              <span>API Online</span>
            </div>

            <Link
              href="/payments/manual"
              target="_blank"
              className="btn btn-ghost btn-sm"
              title="Open public manual payment submission portal"
              style={{ fontSize: 12, padding: '5px 10px', gap: 6 }}
            >
              <span>Payment Portal</span>
              <ExternalLink size={12} />
            </Link>

            <ThemeToggle />

            <NotificationBell />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
