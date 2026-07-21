/**
 * @module components/mobile/MobileNotificationItem
 * @description A single notification row for the mobile dashboard's
 *   recent-activity list.  Shows a coloured dot for unread state,
 *   title, body preview, and relative timestamp.
 *
 * @example
 * ```tsx
 * <MobileNotificationItem
 *   item={{ id: "1", title: "New application", body: "You received…", read: false, createdAt: "…" }}
 * />
 * ```
 */

/**
 * Shape of a notification entity matching the API response.
 */
export interface NotificationItem {
  /** Unique notification identifier. */
  id: string;
  /** Notification headline. */
  title: string;
  /** Notification body / preview text. */
  body: string;
  /** Whether the user has already read this notification. */
  read: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/**
 * Props for the {@link MobileNotificationItem} component.
 *
 * @property item - The notification data to render.
 */
export interface MobileNotificationItemProps {
  item: NotificationItem;
}

/**
 * Formats an ISO timestamp into a compact relative string like "2h ago".
 *
 * @param iso - ISO-8601 date string.
 * @returns A human-readable relative time string.
 */
function formatRelativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Renders a single notification row with unread indicator.
 *
 * @param props - {@link MobileNotificationItemProps}
 * @returns The rendered notification list item.
 */
export default function MobileNotificationItem({
  item,
}: MobileNotificationItemProps) {
  return (
    <div
      className={`
        flex items-start gap-3 rounded-2xl border p-3.5 transition-colors
        ${item.read
          ? "border-primary/5 bg-white"
          : "border-brandGreen/20 bg-brandGreen/[.04]"
        }
      `}
    >
      {/* Unread indicator dot */}
      <span
        className={`
          mt-1.5 h-2 w-2 shrink-0 rounded-full
          ${item.read ? "bg-border" : "bg-brandGreen"}
        `}
      />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-bold ${
            item.read ? "text-ink" : "text-primary"
          }`}
        >
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
          {item.body}
        </p>
        <p className="mt-1.5 text-[10px] text-muted/70">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );
}