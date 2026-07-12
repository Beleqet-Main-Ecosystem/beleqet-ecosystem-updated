'use client';

import { useState, useEffect } from 'react';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { getToken } from '@/lib/auth';

/**
 * MessagesPage
 *
 * Minimal integration demo for the Socket Balance task's frontend
 * requirement ("Connection Resilience"). This page is intentionally
 * small — it is not a full chat UI, only a proof that useSocket
 * connects to the live ChatGateway, survives reconnects, and reflects
 * connection status visibly to the user.
 */
export default function MessagesPage() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000';
    const [token, setToken] = useState<string | null | undefined>(undefined);
  
    useEffect(() => {
      setToken(getToken());
    }, []);
  
    const { socket, status } = useSocket({
    url: apiUrl,
    token: token ?? undefined,
    namespace: '/chat',
  });

  const [messages, setMessages] = useState<string[]>([]);

  useSocketEvent<{ content: string }>(socket, 'new_message', (payload) => {
    setMessages((prev) => [...prev, payload.content]);
  });

  const statusColor: Record<string, string> = {
    idle: 'bg-gray-400',
    connecting: 'bg-yellow-400',
    connected: 'bg-green-500',
    reconnecting: 'bg-orange-500',
    disconnected: 'bg-red-500',
    error: 'bg-red-700',
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Live Connection Demo</h1>

      <div className="flex items-center gap-2 mb-6">
        <span className={`w-3 h-3 rounded-full ${statusColor[status]}`} />
        <span className="text-sm text-gray-600 capitalize">{status}</span>
      </div>

      {token === null && (
        <p className="text-sm text-amber-600 mb-4">
          You are not logged in — connection will be rejected by the server&apos;s JWT check.
          Log in first to see a successful connection.
        </p>
      )}

      <div className="border rounded-lg p-4 h-64 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400">No messages yet.</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="text-sm mb-1">{msg}</div>
          ))
        )}
      </div>
    </div>
  );
}