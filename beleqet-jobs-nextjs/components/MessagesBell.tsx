"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Lock, Search, ChevronRight, Clock, Loader2, Edit, UserPlus } from "lucide-react";
import { authenticatedFetch, getToken } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: string;
};

type Room = {
  id: string;
  contractId?: string;
  createdAt: string;
  recipient: Recipient | null;
  lastMessage: { id: string; createdAt: string; hasContent: boolean } | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Avatar({ recipient }: { recipient: Recipient | null }) {
  const name = recipient ? `${recipient.firstName} ${recipient.lastName}` : "?";
  const initial = name[0]?.toUpperCase() ?? "?";
  if (recipient?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={recipient.avatarUrl}
        alt={name}
        className="h-10 w-10 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
      {initial}
    </div>
  );
}

export default function MessagesBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [globalUsers, setGlobalUsers] = useState<Recipient[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadRooms = useCallback(async () => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/chat/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load rooms on mount and when dropdown is opened
  useEffect(() => {
    if (open) {
      loadRooms();
    }
  }, [open, loadRooms]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Close on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Search global users when search term changes
  useEffect(() => {
    if (search.length < 2) {
      setGlobalUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingGlobal(true);
      try {
        const res = await authenticatedFetch(`${API_URL}/users/search?q=${encodeURIComponent(search)}`);
        if (res.ok) setGlobalUsers(await res.json());
      } finally {
        setSearchingGlobal(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function startNewChat(userId: string) {
    try {
      const res = await authenticatedFetch(`${API_URL}/chat/rooms`, {
        method: "POST",
        body: JSON.stringify({ recipientId: userId }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const room = await res.json();
        setOpen(false);
        router.push(`/chat?room=${room.id}&recipient=${userId}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return null;

  const filtered = rooms.filter((r) => {
    if (!search) return true;
    const name = `${r.recipient?.firstName ?? ""} ${r.recipient?.lastName ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const totalRooms = rooms.length;

  // ── Mobile: just a link icon to /messages page ─────────────────────────────
  const mobileButton = (
    <Link
      href="/messages"
      aria-label="Messages"
      className="lg:hidden relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 text-primary hover:bg-primary/5 transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
      {totalRooms > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-5 text-white">
          {totalRooms > 9 ? "9+" : totalRooms}
        </span>
      )}
    </Link>
  );

  // ── Desktop: dropdown panel ─────────────────────────────────────────────────
  const desktopButton = (
    <div className="relative hidden lg:block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Messages`}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 text-primary hover:bg-primary/5 transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        {totalRooms > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-5 text-white">
            {totalRooms > 9 ? "9+" : totalRooms}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-lg font-extrabold text-gray-900">Chats</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { router.push("/messages"); setOpen(false); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
                title="Open all messages"
              >
                <Edit className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 ring-1 ring-transparent focus-within:ring-emerald-400 transition-all">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Messenger"
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : filtered.length === 0 && search.length < 2 ? (
              <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm text-gray-500">
                  {search ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filtered.map((room) => {
                const recipient = room.recipient;
                const name = recipient
                  ? `${recipient.firstName} ${recipient.lastName}`
                  : "Unknown";
                const chatUrl = `/chat?room=${room.id}&recipient=${recipient?.id ?? ""}&lang=en`;
                const timeStr = room.lastMessage
                  ? timeAgo(room.lastMessage.createdAt)
                  : timeAgo(room.createdAt);

                return (
                  <Link
                    key={room.id}
                    href={chatUrl}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <Avatar recipient={recipient} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {name}
                        </span>
                        <span className="text-[11px] text-gray-400 ml-2 shrink-0 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeStr}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <Lock className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                        {room.lastMessage?.hasContent
                          ? "Encrypted message"
                          : "Say hello!"}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                  </Link>
                );
              })
            )}

            {/* Global Search Results */}
            {search.length >= 2 && (
              <div className="border-t border-gray-100">
                <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Start new chat</p>
                {searchingGlobal ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  </div>
                ) : globalUsers.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">No new users found for &quot;{search}&quot;</p>
                ) : (
                  globalUsers.map((u) => {
                    // Check if they are already in the local filtered rooms to avoid duplicates
                    if (rooms.some(r => r.recipient?.id === u.id)) return null;
                    return (
                      <button
                        key={u.id}
                        onClick={() => startNewChat(u.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left"
                      >
                        <Avatar recipient={u} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-emerald-600 font-medium truncate">
                            Tap to message <Lock className="h-2.5 w-2.5 inline ml-0.5 mb-0.5" />
                          </p>
                        </div>
                        <UserPlus className="h-4 w-4 text-emerald-500 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer — see all */}
          <div className="border-t border-gray-100 p-3">
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-sm font-semibold text-gray-600"
            >
              See all in Messages
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mobileButton}
      {desktopButton}
    </>
  );
}
