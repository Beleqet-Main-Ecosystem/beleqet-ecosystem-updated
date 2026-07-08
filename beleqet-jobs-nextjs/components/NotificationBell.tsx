"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Item = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (!user) return;
    const response = await authenticatedFetch(`${API_URL}/users/notifications`);
    if (response.ok) setItems(await response.json());
  }, [user]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!user) return null;
  const unread = items.filter((item) => !item.read).length;
  async function read(item: Item) {
    if (!item.read) {
      await authenticatedFetch(
        `${API_URL}/users/notifications/${item.id}/read`,
        { method: "PATCH" },
      );
      setItems((old) =>
        old.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
    }
  }
  async function readAll() {
    await authenticatedFetch(`${API_URL}/users/notifications/read-all`, {
      method: "PATCH",
    });
    setItems((old) => old.map((n) => ({ ...n, read: true })));
  }
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        aria-label={`Notifications, ${unread} unread`}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 text-primary hover:bg-primary/5"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-redAccent px-1 text-[10px] font-bold leading-5 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <p className="text-sm font-extrabold text-primary">Notifications</p>
            {unread > 0 && (
              <button
                onClick={readAll}
                className="flex items-center gap-1 text-xs font-bold text-brandGreen"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => read(item)}
                  className={`block w-full border-b border-border p-4 text-left hover:bg-pageBg ${item.read ? "opacity-60" : "bg-brandGreen/[.04]"}`}
                >
                  <p className="text-sm font-bold text-primary">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {item.body}
                  </p>
                  <p className="mt-2 text-[10px] text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-muted">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
