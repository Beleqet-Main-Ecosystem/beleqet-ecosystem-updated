'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Currency, Locale } from './translations';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
/** WebSocket origin is the API URL without the `/api/v1` path suffix. */
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/\/api\/v1\/?$/, '') || 'http://localhost:4000';

/**
 * Manages a FAQ Bot session with real-time WebSocket streaming and a REST fallback.
 * @param locale - Active UI locale (sent as Accept-Language)
 * @param currency - Preferred display currency for monetary answers
 */
export function useFaqBotStream(locale: Locale, currency: Currency) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const getAnonymousId = useCallback(() => {
    if (typeof window === 'undefined') return 'anon-server';
    const key = 'beleqet_faq_anon_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `anon-${crypto.randomUUID()}`;
      localStorage.setItem(key, id);
    }
    return id;
  }, []);

  /** Create a GDPR-compliant session after the user grants consent. */
  const startSession = useCallback(async () => {
    setError(null);
    const res = await fetch(`${API_URL}/faq-bot/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
      body: JSON.stringify({
        anonymousId: getAnonymousId(),
        locale,
        preferredCurrency: currency,
        consentGiven: true,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? 'Failed to create FAQ session');
    }

    const data = (await res.json()) as { sessionId: string; welcomeMessage: string };

    setSessionId(data.sessionId);
    setMessages([{ id: 'welcome', role: 'system', content: data.welcomeMessage }]);

    if (!socketRef.current) {
      socketRef.current = io(`${WS_URL}/faq-bot`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      socketRef.current.on('stream_start', () => setIsStreaming(true));

      socketRef.current.on('stream_chunk', ({ token }: { token: string }) => {
        const streamId = streamingIdRef.current;
        if (!streamId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId ? { ...m, content: m.content + token, streaming: true } : m,
          ),
        );
      });

      socketRef.current.on('stream_end', (payload: { content?: string }) => {
        const streamId = streamingIdRef.current;
        streamingIdRef.current = null;
        setIsStreaming(false);
        if (streamId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { ...m, content: payload.content ?? m.content, streaming: false }
                : m,
            ),
          );
        }
      });

      socketRef.current.on('error', (payload: { message?: string }) => {
        setError(payload.message ?? 'Connection error');
        setIsStreaming(false);
      });
    }

    return data.sessionId;
  }, [currency, getAnonymousId, locale]);

  /** Send a question; streams the answer over WebSocket, falling back to REST. */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim()) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      };

      const assistantId = `assistant-${Date.now()}`;
      streamingIdRef.current = assistantId;

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);

      if (socketRef.current?.connected) {
        socketRef.current.emit('ask', { sessionId, message: text.trim() });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/faq-bot/sessions/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text.trim() }),
        });
        const data = (await res.json()) as { content: string; messageId: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { id: data.messageId, role: 'assistant', content: data.content }
              : m,
          ),
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        streamingIdRef.current = null;
        setIsStreaming(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { sessionId, messages, isStreaming, error, startSession, sendMessage };
}
