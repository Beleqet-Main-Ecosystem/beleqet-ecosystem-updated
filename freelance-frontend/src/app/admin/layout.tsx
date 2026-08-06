'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/api';
import { ShieldCheck, LogOut, LayoutDashboard, Gavel } from 'lucide-react';

interface User {
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Shared admin layout - sidebar navigation + RBAC guard.
 * All admin pages are wrapped in this layout.
 * Redirects to /login if the user is not authenticated or is not an ADMIN.
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
    const parsed: User = JSON.parse(storedUser);
    if (parsed.role !== 'ADMIN') {
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

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/admin/disputes', label: 'Dispute Manager', icon: <Gavel size={18} /> },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <ShieldCheck size={20} />
          </div>
          <span className="sidebar-logo-text">Beleqet</span>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="name">
              {user.firstName} {user.lastName}
            </div>
            <div className="role">{user.role}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} title="Logout" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/*  Main content  */}
      <main className="main-content">{children}</main>
    </div>
  );
}
