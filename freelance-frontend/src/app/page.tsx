'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page - redirects to the admin dashboard if the user is logged in,
 * or to the login page if not.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  );
}
