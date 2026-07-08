'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export default function MessagesPage() {
  const socket = useSocket('/chat');
  const [roomId, setRoomId] = useState('main-room'); // Default Room
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!socket) return;

    // ሩሙን ጆይን ማድረግ
    socket.emit('join_room', { roomId });

    // የቆዩ መልእክቶችን መቀበል
    socket.on('room_history', (history: Message[]) => {
      setMessages(history);
    });

    // አዲስ መልእክት ሲመጣ መቀበል
    socket.on('new_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // ስህተት ሲፈጠር ማዳመጥ
    socket.on('error', (err: { message: string }) => {
      alert(err.message);
    });

    return () => {
      socket.off('room_history');
      socket.off('new_message');
      socket.off('error');
    };
  }, [socket, roomId]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    socket.emit('send_message', { roomId, content: input });
    setInput('');
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h1 className="text-xl font-bold text-black">Beleqet Messaging</h1>
      <div className="h-64 overflow-y-auto border p-2 rounded bg-gray-50 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="p-2 bg-blue-100 rounded text-black text-sm">
            <span className="font-semibold">{msg.senderId}: </span>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          className="border p-2 w-full rounded text-black"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="bg-blue-600 text-white p-2 rounded">
          Send
        </button>
      </div>
    </div>
  );
}