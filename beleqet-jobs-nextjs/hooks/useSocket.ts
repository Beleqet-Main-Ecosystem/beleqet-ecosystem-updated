'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Connection lifecycle states exposed by useSocket.
 */
export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/**
 * Options accepted by useSocket.
 */
export interface UseSocketOptions {
  /** Base URL of the backend Socket.io server, e.g. https://beleqet-backend-rakz.onrender.com */
  url: string;
  /** JWT access token to authenticate the connection (sent as handshake.auth.token) */
  token?: string;
  /** Socket.io namespace to connect to (matches ChatGateway's `/chat` namespace) */
  namespace?: string;
  /** Maximum number of automatic reconnection attempts before giving up (default: Infinity) */
  reconnectionAttempts?: number;
  /** Base delay in ms between reconnection attempts, used with exponential backoff (default: 1000) */
  reconnectionDelay?: number;
  /** Upper bound in ms for the exponential backoff delay (default: 10000) */
  reconnectionDelayMax?: number;
}

/**
 * useSocket
 *
 * React hook providing a resilient Socket.io client connection with
 * automatic reconnection and exponential backoff.
 *
 * Why this exists:
 * A naive `io(url)` call disconnects permanently on any transient
 * network drop (e.g. mobile network switch, temporary server restart
 * during a deploy). This hook wraps Socket.io's built-in reconnection
 * behavior, exposes connection status to the UI so users get visible
 * feedback (e.g. "Reconnecting…") instead of a silently dead chat,
 * and cleans up the connection automatically on unmount.
 *
 * Usage:
 * ```tsx
 * const { socket, status } = useSocket({ url: API_URL, token, namespace: '/chat' });
 * useEffect(() => {
 *   if (!socket) return;
 *   socket.on('new_message', handleNewMessage);
 *   return () => { socket.off('new_message', handleNewMessage); };
 * }, [socket]);
 * ```
 */
export function useSocket(options: UseSocketOptions): {
  socket: Socket | null;
  status: SocketStatus;
} {
  const {
    url,
    token,
    namespace = '',
    reconnectionAttempts = Infinity,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 10000,
  } = options;

  const [status, setStatus] = useState<SocketStatus>('idle');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');

    const socket = io(`${url}${namespace}`, {
      auth: token ? { token: `Bearer ${token}` } : undefined,
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      // Exponential backoff with jitter is Socket.io's default behavior
      // once reconnectionDelay/reconnectionDelayMax are set.
    });

    socketRef.current = socket;

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('reconnect_attempt', () => setStatus('reconnecting'));
    socket.on('reconnect_failed', () => setStatus('error'));
    socket.on('connect_error', () => setStatus('error'));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, token, namespace, reconnectionAttempts, reconnectionDelay, reconnectionDelayMax]);

  const socket = socketRef.current;

  return { socket, status };
}

/**
 * useSocketEvent
 *
 * Convenience helper for subscribing to a single Socket.io event with
 * automatic cleanup, avoiding repetitive `useEffect` boilerplate in
 * every component that listens for chat events.
 */
export function useSocketEvent<TPayload = unknown>(
  socket: Socket | null,
  event: string,
  handler: (payload: TPayload) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const wrapped = (payload: TPayload) => handlerRef.current(payload);
    socket.on(event, wrapped);

    return () => {
      socket.off(event, wrapped);
    };
  }, [socket, event]);
}