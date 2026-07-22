'use client';
import type { Notification } from '@/types';
import { Mail, Briefcase, DollarSign, Calendar, Bell, AlertCircle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  APPLICATION_SUBMITTED: { icon: <Briefcase size={16} />, color: 'rgba(59,130,246,0.15)' },
  APPLICATION_SHORTLISTED: { icon: <Briefcase size={16} />, color: 'rgba(16,185,129,0.15)' },
  APPLICATION_REJECTED: { icon: <AlertCircle size={16} />, color: 'rgba(244,63,94,0.15)' },
  APPLICATION_STATUS: { icon: <Briefcase size={16} />, color: 'rgba(59,130,246,0.15)' },
  INTERVIEW_SCHEDULED: { icon: <Calendar size={16} />, color: 'rgba(139,92,246,0.15)' },
  CONTRACT_CREATED: { icon: <Briefcase size={16} />, color: 'rgba(245,158,11,0.15)' },
  PAYMENT_RECEIVED: { icon: <DollarSign size={16} />, color: 'rgba(16,185,129,0.15)' },
  PAYMENT_RELEASED: { icon: <DollarSign size={16} />, color: 'rgba(16,185,129,0.15)' },
  ADMIN_ANNOUNCEMENT: { icon: <Bell size={16} />, color: 'rgba(139,92,246,0.15)' },
};

const DEFAULT_CONFIG = { icon: <Mail size={16} />, color: 'rgba(59,130,246,0.15)' };

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  compact?: boolean;
}

export default function NotificationItem({ notification, onMarkRead, compact = false }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type] ?? DEFAULT_CONFIG;

  function handleClick() {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  }

  return (
    <button
      type="button"
      className={`notif-item ${notification.read ? 'notif-item--read' : 'notif-item--unread'}`}
      onClick={handleClick}
    >
      <div className="notif-item-icon" style={{ background: config.color }}>
        {config.icon}
      </div>
      <div className="notif-item-body">
        <p className="notif-item-title">{notification.title}</p>
        {!compact && <p className="notif-item-text">{notification.body}</p>}
        <p className="notif-item-time">{formatTime(notification.createdAt)}</p>
      </div>
      {!notification.read && <span className="notif-item-dot" />}
    </button>
  );
}
