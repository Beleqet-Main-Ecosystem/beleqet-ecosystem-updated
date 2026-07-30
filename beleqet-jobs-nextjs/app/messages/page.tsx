'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch, getToken } from '@/lib/auth';
import { MessageCircle, Lock, ChevronRight, Clock, ShieldCheck, Search, Loader2, UserPlus } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = name?.[0]?.toUpperCase() ?? '?';
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-12 w-12 text-base';
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold shrink-0`}>
      {initial}
    </div>
  );
}

export default function MessagesPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [globalUsers, setGlobalUsers] = useState<Recipient[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const token = getToken();
    if (!token) return;

    fetch(`${API_URL}/chat/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setRooms(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load conversations.');
        setLoading(false);
      });
  }, [ready, user, router]);

  // Search global users
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
        router.push(`/chat?room=${room.id}&recipient=${userId}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = rooms.filter((r) => {
    if (!search) return true;
    const name = `${r.recipient?.firstName ?? ''} ${r.recipient?.lastName ?? ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm">Loading conversations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h1 className="text-lg font-bold text-gray-900">Messages</h1>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> E2EE
            </span>
          </div>
          <span className="text-xs text-gray-400">{rooms.length} conversation{rooms.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 ring-1 ring-transparent focus-within:ring-emerald-400 transition-all">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
        )}

        {!loading && filtered.length === 0 && search.length < 2 && (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">
                {search ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-sm text-gray-400">
                {search
                  ? 'Try a different name'
                  : 'Start a conversation by contacting a user from their profile or a job listing.'}
              </p>
            </div>
          </div>
        )}

        {filtered.map((room) => {
          const recipient = room.recipient;
          const name = recipient
            ? `${recipient.firstName} ${recipient.lastName}`
            : 'Unknown User';
          const chatUrl = `/chat?room=${room.id}&recipient=${recipient?.id ?? ''}&lang=en`;

          return (
            <Link
              key={room.id}
              href={chatUrl}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group"
            >
              {/* Avatar */}
              {recipient?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipient.avatarUrl}
                  alt={name}
                  className="h-12 w-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <InitialsAvatar name={name} />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-gray-900 truncate">{name}</span>
                  {room.lastMessage && (
                    <span className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0 ml-2">
                      <Clock className="h-3 w-3" />
                      {timeAgo(room.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                  <p className="text-xs text-gray-400 truncate">
                    {room.lastMessage?.hasContent
                      ? 'Encrypted message'
                      : 'No messages yet — say hello!'}
                  </p>
                </div>
                {recipient?.role && (
                  <span className="mt-1 inline-block text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                    {recipient.role.replace('_', ' ').toLowerCase()}
                  </span>
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
            </Link>
          );
        })}

        {/* Global Search Results */}
        {search.length >= 2 && (
          <div className={filtered.length > 0 ? "mt-8 border-t border-gray-200 pt-6" : ""}>
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-500" />
              Find new people
            </h2>
            
            {searchingGlobal ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : globalUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No users found for &quot;{search}&quot;</p>
            ) : (
              <div className="space-y-3">
                {globalUsers.map((u) => {
                  if (rooms.some(r => r.recipient?.id === u.id)) return null;
                  
                  return (
                    <button
                      key={u.id}
                      onClick={() => startNewChat(u.id)}
                      className="w-full flex items-center gap-4 bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group text-left"
                    >
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt={u.firstName} className="h-12 w-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <InitialsAvatar name={`${u.firstName} ${u.lastName}`} />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">Click to start an encrypted chat</p>
                        {u.role && (
                          <span className="mt-1 inline-block text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full capitalize">
                            {u.role.replace('_', ' ').toLowerCase()}
                          </span>
                        )}
                      </div>
                      
                      <UserPlus className="h-5 w-5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Info banner */}
        <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-3 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 leading-relaxed">
            All messages are <strong>end-to-end encrypted</strong>. The server only stores ciphertext.
            Your private key never leaves your device.
          </p>
        </div>
      </div>
    </div>
  );
}