'use client';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from '@/components/Notifications/NotificationItem';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } = useNotifications();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Notifications</h1>
          <p className="page-header-subtitle">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      <div className="page-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            <strong>Problem loading notifications:</strong> {error}
          </div>
        )}

        {loading && notifications.length === 0 ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading notifications…</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty-state">
            <Bell size={48} strokeWidth={1.5} />
            <h3>No notifications</h3>
            <p>You&apos;ll see notifications about your applications, interviews, and payments here.</p>
          </div>
        ) : (
          <div className="notif-list">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
