/** Messages: rooms, history and the live socket. Same API as the website's Messages page. */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { get, send } from '../lib/api';
import { API_URL } from '../lib/config';
import { ACCESS_TOKEN_KEY } from './client';

export type Person = { id: string; firstName: string; lastName: string };
export type ChatMessage = { id: string; roomId: string; senderId: string; content: string; createdAt: string };
export type Room = {
  id: string;
  contractId: string | null;
  jobId: string | null;
  createdAt: string;
  participants: { user: Person }[];
  messages: ChatMessage[];
  contract?: { id: string; freelanceJob?: { title: string } | null } | null;
  job?: { id: string; title: string } | null;
  unread?: boolean;
};

export const fetchRooms = () => get<Room[]>('/chat/rooms');
export const fetchMessages = (roomId: string) => get<ChatMessage[]>(`/chat/rooms/${encodeURIComponent(roomId)}/messages`);
export const markRoomRead = (roomId: string) => send('POST', `/chat/rooms/${encodeURIComponent(roomId)}/read`);
/** Opens (or finds) the conversation with someone; returns the room. */
export const startChat = (recipientId: string) => send<{ id: string }>('POST', '/chat/rooms', { recipientId });

const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

export type SocketState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/**
 * The live chat connection, authenticated with the current access token. Reconnects with the
 * newest token when a connection drops (access tokens are short-lived and refreshed by REST calls).
 */
export function useChatSocket(): { socket: Socket | null; state: SocketState } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<SocketState>('connecting');
  const current = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (cancelled || !token) return;
      const connection = io(`${SOCKET_URL}/chat`, {
        transports: ['websocket'],
        auth: { token },
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      connection.on('connect', () => setState('connected'));
      connection.on('disconnect', () => setState('reconnecting'));
      connection.on('connect_error', async () => {
        setState('reconnecting');
        // The token may have expired: try again with the freshest one.
        const fresh = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (fresh) connection.auth = { token: fresh };
      });
      connection.io.on('reconnect_failed', () => setState('offline'));
      current.current = connection;
      setSocket(connection);
    })().catch(() => setState('offline'));
    return () => {
      cancelled = true;
      current.current?.disconnect();
      current.current = null;
    };
  }, []);

  return { socket, state };
}
