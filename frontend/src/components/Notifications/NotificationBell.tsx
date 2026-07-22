'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from './NotificationItem';

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const previewItems = notifications.slice(0, 8);

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h3 className="notif-dropdown-title">Notifications</h3>
            <div className="notif-dropdown-actions">
              {unreadCount > 0 && (
                <button type="button" className="notif-mark-all-btn" onClick={markAllRead}>
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <Link
                href="/admin/settings/notifications"
                className="notif-settings-link"
                onClick={() => setOpen(false)}
              >
                <Settings size={14} />
              </Link>
            </div>
          </div>

          <div className="notif-dropdown-list">
            {previewItems.length === 0 ? (
              <div className="notif-dropdown-empty">No notifications yet</div>
            ) : (
              previewItems.map((n) => (
                <NotificationItem key={n.id} notification={n} onMarkRead={markRead} compact />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notif-dropdown-footer">
              <Link href="/admin/notifications" onClick={() => setOpen(false)}>
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
