'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getToken } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { initials } from '@/features/jobs/format';
import { apiGet, apiSend } from '@/features/dashboard/api';
import { card, Empty, Failed, Heading, muted, solid } from '@/features/dashboard/ui';
import { errorText } from '@/lib/api-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

type Person = { id: string; firstName: string; lastName: string };
type Message = { id: string; roomId: string; senderId: string; content: string; createdAt: string };
type Room = {
  id: string;
  contractId: string | null;
  jobId: string | null;
  createdAt: string;
  participants: { user: Person }[];
  messages: Message[];
  contract?: { id: string; freelanceJob?: { title: string } | null } | null;
  job?: { id: string; title: string } | null;
  unread?: boolean;
};

export default function Messages() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | undefined>(undefined);
  const endRef = useRef<HTMLLIElement>(null);

  const { socket, status } = useSocket({ url: token ? SOCKET_URL : '', token, namespace: '/chat' });
  const connected = status === 'connected';

  // Access tokens are short-lived and refreshed by REST calls; reconnect with the newest one.
  useEffect(() => {
    if (status !== 'error' && status !== 'disconnected') return;
    const fresh = getToken() ?? undefined;
    if (fresh && fresh !== token) setToken(fresh);
  }, [status, token]);

  // ?to=<userId> opens (or starts) a chat with an employer or applicant; ?contractId= opens a contract's chat.
  const to = params.get('to');
  const contractId = params.get('contractId');
  const roomParam = params.get('room');

  const load = useCallback(async () => {
    setFailed(false);
    setError('');
    try {
      let target: string | null = roomParam;
      if (to) {
        try {
          const room = await apiSend<{ id: string }>('POST', '/chat/rooms', { recipientId: to });
          target = room.id;
        } catch (problem) {
          setError(errorText(problem, t, 'chat.startFailed'));
        }
      }
      const list = await apiGet<Room[]>('/chat/rooms');
      setRooms(list);
      const match = contractId ? list.find((room) => room.contractId === contractId) : list.find((room) => room.id === target);
      if (match) setActiveId(match.id);
    } catch {
      setFailed(true);
    }
  }, [to, contractId, roomParam, t]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/messages')}`);
      return;
    }
    setToken(getToken() ?? undefined);
    void load();
  }, [ready, user, router, load]);

  // History comes over REST so the thread shows even while the socket connects.
  useEffect(() => {
    if (!activeId) return;
    setThread(null);
    apiGet<Message[]>(`/chat/rooms/${activeId}/messages`).then(setThread).catch(() => setThread([]));
    apiSend('POST', `/chat/rooms/${activeId}/read`).catch(() => undefined);
    setRooms((list) => list && list.map((room) => (room.id === activeId ? { ...room, unread: false } : room)));
  }, [activeId]);

  useEffect(() => {
    if (socket && connected && activeId) socket.emit('join_room', { roomId: activeId });
  }, [socket, connected, activeId]);

  useSocketEvent<Message>(socket, 'new_message', (message) => {
    if (message.roomId === activeId) {
      setThread((list) => (list && !list.some((item) => item.id === message.id) ? [...list, message] : list));
      apiSend('POST', `/chat/rooms/${message.roomId}/read`).catch(() => undefined);
    }
    setRooms((list) => {
      if (!list) return list;
      const updated = list.map((room) => (room.id === message.roomId ? { ...room, messages: [message], unread: message.roomId !== activeId && message.senderId !== user?.id } : room));
      return [...updated].sort((a, b) => latest(b) - latest(a));
    });
  });

  useSocketEvent<{ message?: string }>(socket, 'error', () => setError(t('chat.sendFailed')));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread]);

  if (!ready || !user) return <div className="min-h-[60vh]" />;

  const other = (room: Room) => room.participants.find((item) => item.user.id !== user.id)?.user;
  const name = (room: Room) => {
    const person = other(room);
    return person ? `${person.firstName} ${person.lastName}`.trim() : t('chat.someone');
  };
  const context = (room: Room) => room.contract?.freelanceJob?.title ?? room.job?.title ?? '';
  const time = (iso: string) => {
    const date = new Date(iso);
    const sameDay = date.toDateString() === new Date().toDateString();
    return date.toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
  };
  const active = rooms?.find((room) => room.id === activeId) ?? null;

  function send(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !activeId || !socket || !connected) return;
    setError('');
    socket.emit('send_message', { roomId: activeId, content });
    setDraft('');
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pb-14 pt-4 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
      <Heading title={t('chat.title')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {failed && <Failed onRetry={load} />}
      {!failed && rooms === null && <div className="min-h-[40vh]" />}
      {!failed && rooms?.length === 0 && <Empty title={t('chat.empty')} text={t('chat.emptyText')} />}

      {!failed && rooms && rooms.length > 0 && (
        <div className="flex min-h-[620px] overflow-hidden rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
          <section aria-label={t('chat.conversations')} className={`${active ? 'hidden md:flex' : 'flex'} w-full flex-col border-ink-200 md:w-[340px] md:shrink-0 md:border-r dark:border-slate-800`}>
            {rooms.map((room) => {
              const last = room.messages[0];
              const current = room.id === activeId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveId(room.id)}
                  aria-current={current ? 'true' : undefined}
                  className={`flex items-start gap-3 border-b border-[#F1F4F6] px-4 py-3.5 text-left dark:border-slate-800 ${current ? 'bg-[#F1F7EC] dark:bg-slate-800' : 'hover:bg-[#FAFBF9] dark:hover:bg-slate-800/60'}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-obsidian text-[13px] font-extrabold text-limeAccent" aria-hidden="true">{initials(name(room))}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex justify-between gap-2">
                      <b className="truncate text-sm text-ink-900 dark:text-white">{name(room)}</b>
                      <span className="shrink-0 text-xs text-ink-500 dark:text-slate-400">{time(last?.createdAt ?? room.createdAt)}</span>
                    </span>
                    {context(room) && <span className="truncate text-xs font-semibold text-forest dark:text-limeAccent">{context(room)}</span>}
                    <span className="truncate text-[13px] text-ink-500 dark:text-slate-400">{last?.content ?? t('chat.noMessagesYet')}</span>
                  </span>
                  {room.unread && <span className="mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full bg-forest dark:bg-limeAccent"><span className="sr-only">{t('chat.unread')}</span></span>}
                </button>
              );
            })}
          </section>

          <section aria-label={active ? t('chat.with').replace('{name}', name(active)) : undefined} className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <span className={muted}>{t('chat.pick')}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-ink-200 px-4 py-3.5 md:px-5 dark:border-slate-800">
                  <button type="button" onClick={() => setActiveId(null)} aria-label={t('chat.back')} className="grid h-11 w-11 place-items-center rounded-lg text-ink-700 md:hidden dark:text-slate-300">
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <b className="truncate text-base text-ink-900 dark:text-white">{name(active)}</b>
                    {context(active) && <span className="truncate text-[13px] text-ink-500 dark:text-slate-400">{t('chat.about').replace('{title}', context(active))}</span>}
                  </span>
                  {active.contractId ? (
                    <Link href={`/freelance/contracts/${active.contractId}`} className="shrink-0 text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('chat.viewContract')}</Link>
                  ) : active.jobId ? (
                    <Link href={`/jobs/${active.jobId}`} className="shrink-0 text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('chat.viewJob')}</Link>
                  ) : null}
                </div>

                <ol aria-label={t('chat.messages')} className="m-0 flex max-h-[60vh] min-h-[360px] flex-1 list-none flex-col gap-2.5 overflow-y-auto bg-[#FAFBF9] p-4 md:p-5 dark:bg-slate-950">
                  {thread === null ? null : thread.length === 0 ? (
                    <li className={`m-auto text-center ${muted}`}>{t('chat.startText')}</li>
                  ) : (
                    thread.map((message) => {
                      const mine = message.senderId === user.id;
                      return (
                        <li key={message.id} className={`flex max-w-[80%] flex-col gap-1 md:max-w-[70%] ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                          <span className={`whitespace-pre-wrap break-words rounded-[14px] border px-3.5 py-2.5 text-[15px] leading-normal ${mine ? 'border-obsidian bg-obsidian text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-200 bg-surface text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}>{message.content}</span>
                          <span className="text-xs text-ink-500 dark:text-slate-400">{time(message.createdAt)}</span>
                        </li>
                      );
                    })
                  )}
                  <li ref={endRef} aria-hidden="true" />
                </ol>

                <form onSubmit={send} className="flex items-end gap-2 border-t border-ink-200 px-3 py-3 md:px-4 dark:border-slate-800">
                  <label className="flex flex-1">
                    <span className="sr-only">{t('chat.message')}</span>
                    <textarea
                      rows={1}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onKey}
                      placeholder={t('chat.write')}
                      className="min-h-11 flex-1 resize-none rounded-lg border border-ink-300 bg-surface px-3 py-2.5 text-[15px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                  <button type="submit" disabled={!draft.trim() || !connected} className={solid}>{t('chat.send')}</button>
                </form>
                {!connected && <p className={`px-4 pb-3 ${muted}`}>{t('chat.connecting')}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function latest(room: Room) {
  return new Date(room.messages[0]?.createdAt ?? room.createdAt).getTime();
}
