'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export default function MessagesPage() {
  // ወደ /chat ኔምስፔስ ኮኔክት ያደርጋል
  const socket = useSocket('/chat');
  const [roomId, setRoomId] = useState('main-room'); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!socket) return;

    // 1. መጀመሪያ ወደ ክፍሉ (Room) ለመግባት ጥያቄ ይልካል (Authorization በባክኤንድ ይረጋገጣል)
    socket.emit('join_room', { roomId });

    // 2. የቆዩ መልእክቶችን (History) ይቀበላል
    socket.on('room_history', (history: Message[]) => {
      setMessages(history);
    });

    // 3. አዲስ መልእክት ሲመጣ በሪል-ታይም ይቀበላል
    socket.on('new_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // 4. ሴኪውሪቲ ወይም ሌላ ስህተት ካለ መልእክት ያሳያል
    socket.on('error', (err: { message: string }) => {
      alert(`Chat Error: ${err.message}`);
    });

    return () => {
      socket.off('room_history');
      socket.off('new_message');
      socket.off('error');
    };
  }, [socket, roomId]);

  // መልእክት ለመላክ
  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    socket.emit('send_message', { roomId, content: input });
    setInput('');
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4 my-10 border border-gray-200">
      <h1 className="text-2xl font-bold text-gray-900 border-b pb-2">Beleqet Messaging Platform</h1>
      
      {/* የቻት መልእክቶች ማሳያ ሳጥን */}
      <div className="h-80 overflow-y-auto border p-3 rounded-lg bg-gray-50 space-y-3">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center text-sm pt-20">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-gray-800 text-sm">
              <span className="font-bold text-blue-700 block mb-0.5">User {msg.senderId}:</span>
              <p className="text-gray-900 break-words">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      {/* የጽሑፍ መጻፊያ እና መላኪያ */}
      <div className="flex space-x-2">
        <input
          type="text"
          className="border border-gray-300 p-2.5 w-full rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button 
          onClick={sendMessage} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}