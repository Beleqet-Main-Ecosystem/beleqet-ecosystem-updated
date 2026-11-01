'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  MessageSquare,
  ShieldCheck,
  CheckCheck,
  User,
  Paperclip,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { getToken, getStoredUser } from '@/lib/auth';

interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: string;
}

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  metadata?: any;
  createdAt: string;
  sender?: ChatUser;
}

interface ChatRoom {
  id: string;
  contractId?: string;
  contract?: {
    id: string;
    freelanceJob?: { title: string };
  };
  participants: { user: ChatUser }[];
  messages: Message[];
}

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const contractIdParam = searchParams.get('contractId');

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000';
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const currentUser = getStoredUser();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToken(getToken());
  }, []);

  // Initialize live WebSocket connection
  const { socket, status } = useSocket({
    url: apiUrl,
    token: token ?? undefined,
    namespace: '/chat',
  });

  // Fetch Rooms via REST
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const apiEndpoint = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiEndpoint}/chat/rooms`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setRooms(data);

        // If a contractId was passed, find or set matching room
        if (contractIdParam) {
          const matched = data.find((r: ChatRoom) => r.contractId === contractIdParam);
          if (matched) {
            setActiveRoomId(matched.id);
          } else if (data.length > 0) {
            setActiveRoomId(data[0].id);
          }
        } else if (data.length > 0 && !activeRoomId) {
          setActiveRoomId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching chat rooms', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  // Handle joining room on socket
  useEffect(() => {
    if (socket && status === 'connected' && activeRoomId) {
      socket.emit('join_room', { roomId: activeRoomId });
    }
  }, [socket, status, activeRoomId]);

  // Listen to room history emitted from join_room
  useSocketEvent<Message[]>(socket, 'room_history', (history) => {
    setMessages(history || []);
  });

  // Listen to new incoming messages
  useSocketEvent<Message>(socket, 'new_message', (msg) => {
    if (msg.roomId === activeRoomId) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }
    // Update last message in room list
    setRooms((prev) =>
      prev.map((r) => (r.id === msg.roomId ? { ...r, messages: [msg] } : r))
    );
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoomId || !socket) return;

    socket.emit('send_message', {
      roomId: activeRoomId,
      content: inputText.trim(),
    });

    setInputText('');
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const otherParticipant = activeRoom?.participants.find(
    (p) => p.user.id !== currentUser?.id
  )?.user;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAF9] py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[780px] flex flex-col">
        {/* Top Connection Bar */}
        <div className="flex items-center justify-between pb-3 text-xs border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Direct Contract Chat</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">Encrypted socket transmission</span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'connected' ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <Wifi className="h-3.5 w-3.5" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <WifiOff className="h-3.5 w-3.5" /> {status}
              </span>
            )}
          </div>
        </div>

        {/* Main Messenger Container */}
        <div className="mt-3 flex-1 flex rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          {/* Sidebar Conversations List */}
          <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h2 className="text-base font-bold text-slate-900">Conversations</h2>
              <div className="mt-2 relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter chats..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-brandGreen/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingRooms ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
              ) : rooms.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No active conversations yet. Conversations open automatically on accepted proposals.
                </div>
              ) : (
                rooms.map((r) => {
                  const counterpart = r.participants.find((p) => p.user.id !== currentUser?.id)?.user;
                  const isSelected = r.id === activeRoomId;
                  const lastMsg = r.messages?.[0];

                  return (
                    <button
                      key={r.id}
                      onClick={() => setActiveRoomId(r.id)}
                      className={`w-full text-left p-3.5 flex items-start gap-3 transition ${
                        isSelected ? 'bg-white border-l-4 border-[#00653B] shadow-2xs' : 'hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-[#041603] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {counterpart?.firstName?.[0] || 'U'}
                        {counterpart?.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {counterpart ? `${counterpart.firstName} ${counterpart.lastName}` : 'Direct Room'}
                          </p>
                          {lastMsg && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        {r.contract?.freelanceJob?.title && (
                          <p className="text-[11px] font-semibold text-[#00653B] truncate">
                            {r.contract.freelanceJob.title}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {lastMsg?.content || 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Window */}
          <div className="flex-1 flex flex-col bg-white">
            {activeRoom ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#041603] text-[#D8FF3E] flex items-center justify-center font-bold text-xs">
                      {otherParticipant?.firstName?.[0] || 'U'}
                      {otherParticipant?.lastName?.[0] || ''}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {otherParticipant
                          ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
                          : 'Chat Room'}
                      </h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Role: {otherParticipant?.role || 'User'}
                        {activeRoom.contractId && (
                          <span className="text-[#00653B] font-semibold">
                            • Linked Contract: {activeRoom.contractId.slice(0, 8)}...
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {activeRoom.contractId && (
                    <a
                      href={`/freelance/contracts/${activeRoom.contractId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00653B] bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                    >
                      <ShieldCheck className="h-4 w-4" /> View Escrow Milestones
                    </a>
                  )}
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto bg-[#FBFDFB] space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                      <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No messages in this contract room yet.</p>
                      <p className="text-[11px] text-slate-400">
                        Say hello and coordinate deliverables safely.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderId === currentUser?.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                              isMe
                                ? 'bg-[#00653B] text-white rounded-br-xs'
                                : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
                            }`}
                          >
                            <p>{m.content}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 px-1">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#00653B]"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || status !== 'connected'}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#00653B] text-white hover:bg-[#107C41] disabled:opacity-40 transition"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="h-12 w-12 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Select a conversation</p>
                <p className="text-xs text-slate-400">Choose from the left sidebar to start chatting.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading messages...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}
